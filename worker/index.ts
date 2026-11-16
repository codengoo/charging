// Worker tramsac: phục vụ /data/* từ R2 (JSON thô, Cloudflare tự nén), còn lại static assets.
// Build dữ liệu KHÔNG ở đây — chạy bằng GitHub Action (.github/workflows/build-data.yml)
// vì Workers Free plan giới hạn 10ms CPU, không đủ cho parse 72MB snapshot.
interface Env {
  DATA: R2Bucket
  ASSETS: Fetcher
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/data/')) {
      const key = url.pathname.slice('/data/'.length)
      if (!key) return new Response('Not found', { status: 404 })
      const obj = await env.DATA.get(key)
      if (!obj) return new Response('Not found', { status: 404 })
      const headers = new Headers()
      obj.writeHttpMetadata(headers) // Content-Type + Cache-Control (Cloudflare tự nén khi gửi)
      headers.set('ETag', obj.httpEtag)
      return new Response(obj.body, { headers })
    }
    return env.ASSETS.fetch(req)
  },
}
