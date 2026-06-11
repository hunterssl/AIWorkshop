# 无限画布

## 改代码

编辑 `src/` 目录下的 Vue 源码。

## 开发与打包

```powershell
cd e:\xiazai\ComfyUI-master\creative-studio-ui\canvas
npm install
npm run dev      # http://localhost:5173/rh/canvas2/
npm run build    # 输出到 dist/
```

ComfyUI 读取 `dist/` 作为 `/rh/canvas2` 静态资源。

## 虚拟人像库路径

编辑同目录下的 `virtual_image_library.json`：

```json
{
  "base_path": "E:/你的路径/虚拟人像库"
}
```

每个项目文件夹需包含 `icon.png`，子目录为 `role/`、`scene/`、`prop/`、`reference/`。

修改后重启 ComfyUI 生效。
