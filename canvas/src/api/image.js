/**
 * Image API | 图片生成 API
 */

import { request } from '@/utils'

// 生成图片
export const generateImage = (data, options = {}) => {
  const { requestType = 'json', endpoint = '/images/generations', signal } = options
  
  return request({
    url: endpoint,
    method: 'post',
    data,
    signal,
    headers: requestType === 'formdata' ? { 'Content-Type': 'multipart/form-data' } : {}
  })
}

