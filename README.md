# AI 工坊（AIWorkshop）

## 目录结构

```
AIWorkshop/
├── studio/           # 对话式聊天页面（纯前端 HTML/JS/CSS）
│   ├── index.html    #   主入口
│   ├── app.js        #   核心逻辑
│   ├── styles.css    #   主样式
│   ├── comfy/        #   画布构建层（overlay 模式，见下方说明）
│   └── assets/       #   静态资源
│
├── canvas/           # 无限画布模块（Vue 3 + Vite 项目）
│   ├── src/          #   源码（开源画布项目基础）
│   ├── dist/         #   构建产物（被 .gitignore 忽略）
│   └── vite.config.js
│
├── portal/           # 应用中心（纯前端 HTML/JS/CSS）
│   ├── index.html    #   应用列表页
│   ├── open_workflow.html
│   ├── workflow_editor_iframe.html
│   └── static/       #   CSS / JS（唯一真实源）
│
├── server/           # 独立网关服务（aiohttp，可选部署）
│   └── lingying/     #   Python 包
│
├── config/           # 机器相关配置（被 .gitignore 忽略）
│   ├── paths.js      #   本机路径（从 paths.example.js 复制创建）
│   └── paths.example.js  # 配置模板
│
├── data/             # 运行时数据（应用定义、画布数据、封面图）
│   ├── apps/         #   应用 manifest JSON
│   ├── canvas2/      #   画布项目数据
│   └── covers/       #   应用封面图
│
├── studio_users/     # 用户数据（被 .gitignore 忽略）
│   ├── user/         #   ComfyUI 用户配置
│   ├── input/        #   用户上传的输入文件
│   └── output/       #   生成的输出文件
│
├── 虚拟人像库/        # 虚拟人像素材库（角色、场景、道具等）
│
└── deploy/           # 部署脚本与工具
    ├── scripts/      #   启动脚本、防火墙等
    ├── loadtest/     #   压测工具
    ├── nginx/        #   Nginx 配置
    └── systemd/      #   Linux 服务配置
```

## canvas/ 与 studio/comfy/ 的关系

`canvas/` 是基于开源画布项目的 Vue 3 源码。
`studio/comfy/` 是一个 **覆盖层（overlay）构建系统**：

- `studio/comfy/overrides/src/` 中放置需要定制的文件
- 构建时 Vite 插件会优先加载 overrides 中的同名文件
- 不存在 override 的文件则使用 canvas/src/ 原版
- 最终产物统一构建到 `canvas/dist/`

日常开发只改 `canvas/src/`（通用功能）或 `studio/comfy/overrides/`（定制功能）。
构建命令：在 `studio/comfy/` 目录运行 `npm run build`。

## 后端插件

后端是 ComfyUI，通过 `ComfyUI-Portal` 插件对接：
- 插件位置：`{ComfyUI}/custom_nodes/ComfyUI-Portal/`
- 插件通过 `studio.config.json` 指向 AIWorkshop 目录

## 迁移到新机器

只需修改 **2 个配置文件**：

1. **`ComfyUI-Portal/studio.config.json`**（从 `.example.json` 复制）
   - `studio_ui_dir`: AIWorkshop 目录的绝对路径

2. **`AIWorkshop/config/paths.js`**（从 `paths.example.js` 复制）
   - `comfyuiRoot`: ComfyUI 安装目录
   - `virtualImagesBase`: 虚拟人像库目录（默认 AIWorkshop/虚拟人像库）

其他配置项使用相对路径，无需修改。
