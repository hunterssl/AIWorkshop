/**
 * AIWorkshop 路径配置（本文件已被 .gitignore 忽略）
 *
 * 迁移到新机器时，修改此文件中的路径即可。
 * 仅在开发服务器/部署脚本中使用，不会打包到前端产物中。
 */
module.exports = {
    // ComfyUI 安装目录（部署脚本、systemd service 使用）
    comfyuiRoot: 'E:/software/ComfyUI-aki',

    // 虚拟人像库根目录（开发服务器中间件使用）
    // 默认指向 AIWorkshop/虚拟人像库，如需指向其他位置可改为绝对路径
    virtualImagesBase: 'E:/SSL_Dev/AIWorkshop/虚拟人像库',
}
