/**
 * AIWorkshop 路径配置模板
 *
 * 首次部署或迁移到新机器时：
 *   1. 复制本文件为 paths.js（同目录下）
 *   2. 修改下方路径为本机实际路径
 *
 * 本文件（.example.js）会提交到仓库，paths.js 被 .gitignore 忽略。
 */
module.exports = {
    // ComfyUI 安装目录（部署脚本、systemd service 使用）
    comfyuiRoot: '/path/to/ComfyUI',

    // 虚拟人像库根目录（开发服务器中间件使用）
    // 默认指向 AIWorkshop/虚拟人像库，如需指向其他位置可改为绝对路径
    virtualImagesBase: '/path/to/AIWorkshop/虚拟人像库',
}
