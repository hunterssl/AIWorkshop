param(
  [string]$ComfyBaseUrl = "http://127.0.0.1:8188",
  [string]$CleanupPromptFile = ".\cleancache.json",
  [double]$VramThreshold = 0.85,
  [double]$GpuThreshold = 0.95,
  [double]$CpuThreshold = 0.90,
  [double]$RamThreshold = 0.90,
  [switch]$TriggerOnHighGpu,
  [switch]$TriggerOnHighCpu,
  [switch]$TriggerOnHighRam,
  [int]$PollIntervalSeconds = 5,
  [int]$IdleSecondsRequired = 20,
  [int]$BusyQueueCooldownSeconds = 120,
  [int]$CooldownSeconds = 300,
  [int]$RequestTimeoutSeconds = 10,
  [switch]$SkipBusyQueueFree
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:LogFile = Join-Path $PSScriptRoot "vram-guardian.log"
$script:LastCleanupAt = $null
$script:IdleSince = $null

function Write-Log {
  param([string]$Message, [string]$Level = "INFO")
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "[$ts][$Level] $Message"
  Write-Host $line
  Add-Content -Path $script:LogFile -Value $line -Encoding UTF8
}

function Get-ExceptionDetail {
  param([System.Exception]$Exception)

  $msg = $Exception.Message
  $responseBody = $null

  try {
    $resp = $Exception.Response
    if ($null -ne $resp) {
      $stream = $resp.GetResponseStream()
      if ($null -ne $stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
      }
    }
  } catch {
    # 忽略读取响应体时的二次异常
  }

  if ([string]::IsNullOrWhiteSpace($responseBody)) {
    return $msg
  }

  return ("{0} | 响应体: {1}" -f $msg, $responseBody)
}

function Get-GpuUsage {
  $raw = & nvidia-smi --query-gpu=index,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>$null
  if (-not $raw) {
    throw "nvidia-smi 未返回数据，请确认 NVIDIA 驱动与命令可用。"
  }

  $rows = @()
  foreach ($line in ($raw -split "`r?`n")) {
    $trim = $line.Trim()
    if (-not $trim) { continue }
    $parts = $trim -split ","
    if ($parts.Count -lt 5) { continue }
    $idx = [int]($parts[0].Trim())
    $util = [double]($parts[1].Trim())
    $used = [double]($parts[2].Trim())
    $total = [double]($parts[3].Trim())
    $temp = [double]($parts[4].Trim())
    if ($total -le 0) { continue }
    $ratio = $used / $total
    $utilRatio = $util / 100.0
    $rows += [pscustomobject]@{
      Index = $idx
      UtilizationPercent = $util
      UtilizationRatio = $utilRatio
      UsedMB = $used
      TotalMB = $total
      Ratio = $ratio
      TemperatureC = $temp
    }
  }
  # 强制以数组返回，避免单 GPU 时被展开成单对象导致 .Count 报错。
  return ,$rows
}

function Get-SystemUsage {
  try {
    $cpuCounter = Get-Counter '\Processor(_Total)\% Processor Time'
    $ramCounter = Get-Counter '\Memory\% Committed Bytes In Use'
    $cpuPercent = [double]$cpuCounter.CounterSamples[0].CookedValue
    $ramPercent = [double]$ramCounter.CounterSamples[0].CookedValue
  } catch {
    # 回退：在部分本地化系统上，Get-Counter 英文计数器可能不可用。
    $cpuRows = Get-CimInstance Win32_Processor | Select-Object -ExpandProperty LoadPercentage
    $cpuPercent = [double](($cpuRows | Measure-Object -Average).Average)

    $os = Get-CimInstance Win32_OperatingSystem
    $totalKb = [double]$os.TotalVisibleMemorySize
    $freeKb = [double]$os.FreePhysicalMemory
    if ($totalKb -gt 0) {
      $ramPercent = (($totalKb - $freeKb) / $totalKb) * 100.0
    } else {
      $ramPercent = 0.0
    }
  }

  return [pscustomobject]@{
    CpuPercent = $cpuPercent
    CpuRatio = $cpuPercent / 100.0
    RamPercent = $ramPercent
    RamRatio = $ramPercent / 100.0
  }
}

function Get-QueueInfo {
  $url = "$ComfyBaseUrl/queue"
  return Invoke-RestMethod -Method Get -Uri $url -TimeoutSec $RequestTimeoutSeconds
}

function Test-QueueIdle {
  $q = Get-QueueInfo
  $running = @($q.queue_running).Count
  $pending = @($q.queue_pending).Count
  return ($running -eq 0 -and $pending -eq 0)
}

function Get-CleanupPromptPayload {
  if (-not (Test-Path -LiteralPath $CleanupPromptFile)) {
    throw "找不到清理工作流文件: $CleanupPromptFile"
  }
  $raw = Get-Content -LiteralPath $CleanupPromptFile -Raw -Encoding UTF8
  if (-not $raw.Trim()) {
    throw "清理工作流文件为空: $CleanupPromptFile"
  }
  $json = $raw | ConvertFrom-Json
  if ($null -eq $json) {
    throw "清理工作流 JSON 解析失败: $CleanupPromptFile"
  }

  # 支持两种格式：
  # 1) 直接是 Comfy prompt graph
  # 2) 包含 prompt 字段的包装格式
  if ($json.PSObject.Properties.Name -contains "prompt") {
    return @{
      prompt = $json.prompt
      client_id = "vram-guardian"
      extra_data = @{
        rh_vram_guardian = $true
        trigger = "auto_idle_cleanup"
      }
    }
  }

  return @{
    prompt = $json
    client_id = "vram-guardian"
    extra_data = @{
      rh_vram_guardian = $true
      trigger = "auto_idle_cleanup"
    }
  }
}

function Invoke-CleanupPrompt {
  try {
    $payload = Get-CleanupPromptPayload
    $url = "$ComfyBaseUrl/prompt"
    $body = $payload | ConvertTo-Json -Depth 30
    $resp = Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $body -TimeoutSec $RequestTimeoutSeconds
    $promptId = [string]($resp.prompt_id)
    if (-not $promptId) {
      Write-Log "清理任务已提交，但未返回 prompt_id。响应: $($resp | ConvertTo-Json -Depth 8)" "WARN"
    } else {
      Write-Log "已提交清理任务，prompt_id=$promptId"
    }
  } catch {
    $detail = Get-ExceptionDetail -Exception $_.Exception
    throw ("提交清理任务失败: {0}" -f $detail)
  }
}

# 队列一直有任务时：/free 会在「当前任务跑完后、下一个任务开始前」释放显存，无需整队空闲。
function Invoke-ComfyFreeMemory {
  $url = "$ComfyBaseUrl/free"
  $body = @{
    unload_models = $true
    free_memory = $true
  } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $body -TimeoutSec $RequestTimeoutSeconds | Out-Null
  Write-Log "已请求 ComfyUI 释放显存（将在当前任务结束后生效，不中断队列）。"
}

Write-Log ("VRAM 守护启动。Comfy={0}, 阈值: VRAM={1}%, GPU={2}%, CPU={3}%, RAM={4}% (GPU/CPU/RAM 触发开关: {5}/{6}/{7}), 轮询={8}s, 空闲要求={9}s, 忙碌队列冷却={10}s, 空闲清理冷却={11}s, 忙碌队列/free={12}" -f `
  $ComfyBaseUrl,
  [math]::Round($VramThreshold * 100, 1),
  [math]::Round($GpuThreshold * 100, 1),
  [math]::Round($CpuThreshold * 100, 1),
  [math]::Round($RamThreshold * 100, 1),
  [bool]$TriggerOnHighGpu,
  [bool]$TriggerOnHighCpu,
  [bool]$TriggerOnHighRam,
  $PollIntervalSeconds,
  $IdleSecondsRequired,
  $BusyQueueCooldownSeconds,
  $CooldownSeconds,
  (-not $SkipBusyQueueFree))

while ($true) {
  try {
    $gpus = @(Get-GpuUsage)
    $sys = Get-SystemUsage
    if ($gpus.Count -eq 0) {
      Write-Log "未检测到 GPU 数据，本轮跳过。" "WARN"
      Start-Sleep -Seconds $PollIntervalSeconds
      continue
    }

    $maxGpu = $gpus | Sort-Object -Property Ratio -Descending | Select-Object -First 1
    $pressureReasons = @()
    if ($maxGpu.Ratio -ge $VramThreshold) { $pressureReasons += "VRAM" }
    if ($TriggerOnHighGpu -and $maxGpu.UtilizationRatio -ge $GpuThreshold) { $pressureReasons += "GPU" }
    if ($TriggerOnHighCpu -and $sys.CpuRatio -ge $CpuThreshold) { $pressureReasons += "CPU" }
    if ($TriggerOnHighRam -and $sys.RamRatio -ge $RamThreshold) { $pressureReasons += "RAM" }

    $hasPressure = @($pressureReasons).Count -gt 0
    $isIdle = Test-QueueIdle

    if ($isIdle) {
      if ($null -eq $script:IdleSince) {
        $script:IdleSince = Get-Date
      }
    } else {
      $script:IdleSince = $null
    }

    $idleSeconds = 0.0
    if ($null -ne $script:IdleSince) {
      $idleSeconds = [math]::Max(0.0, (New-TimeSpan -Start $script:IdleSince -End (Get-Date)).TotalSeconds)
    }

    $cooldownLeft = 0.0
    $busyCooldownLeft = 0.0
    if ($null -ne $script:LastCleanupAt) {
      $elapsedSinceCleanup = (New-TimeSpan -Start $script:LastCleanupAt -End (Get-Date)).TotalSeconds
      $cooldownLeft = [math]::Max(0.0, ($CooldownSeconds - $elapsedSinceCleanup))
      $busyCooldownLeft = [math]::Max(0.0, ($BusyQueueCooldownSeconds - $elapsedSinceCleanup))
    }

    $reasonText = if ($hasPressure) { $pressureReasons -join "+" } else { "none" }
    Write-Log ("状态: idle={0}, idle_for={1}s, CPU={2:N0}%, RAM={3:N0}%, max_gpu=GPU{4} util={5:N0}% vram={6}/{7}MB ({8:P0}) temp={9:N0}C, pressure={10}, idle_cooldown={11}s, busy_cooldown={12}s" -f `
      $isIdle, [math]::Floor($idleSeconds), $sys.CpuPercent, $sys.RamPercent, $maxGpu.Index, $maxGpu.UtilizationPercent, [math]::Round($maxGpu.UsedMB), [math]::Round($maxGpu.TotalMB), $maxGpu.Ratio, $maxGpu.TemperatureC, $reasonText, [math]::Floor($cooldownLeft), [math]::Floor($busyCooldownLeft))

    if (-not $hasPressure) {
      Start-Sleep -Seconds $PollIntervalSeconds
      continue
    }

    if ($isIdle -and $idleSeconds -ge $IdleSecondsRequired -and $cooldownLeft -le 0) {
      Write-Log ("满足触发条件：{0} 超过阈值且队列空闲，开始提交清理工作流。" -f ($pressureReasons -join "+"))
      try {
        Invoke-CleanupPrompt
      } catch {
        $detail = Get-ExceptionDetail -Exception $_.Exception
        Write-Log ("清理工作流不可用，回退到 /free: {0}" -f $detail) "WARN"
        if (-not $SkipBusyQueueFree) {
          Invoke-ComfyFreeMemory
        }
      }
      $script:LastCleanupAt = Get-Date
    } elseif (-not $isIdle -and -not $SkipBusyQueueFree -and $busyCooldownLeft -le 0) {
      Write-Log ("满足触发条件：{0} 超过阈值且队列忙碌（running/pending），请求任务间隙释放显存。" -f ($pressureReasons -join "+"))
      Invoke-ComfyFreeMemory
      $script:LastCleanupAt = Get-Date
    }
  } catch {
    $detail = Get-ExceptionDetail -Exception $_.Exception
    Write-Log ("守护循环异常: " + $detail) "ERROR"
  }

  Start-Sleep -Seconds $PollIntervalSeconds
}

