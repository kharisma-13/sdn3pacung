export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const clientId = env.CLIENT_ID || env.GITHUB_CLIENT_ID;
    const clientSecret = env.CLIENT_SECRET || env.GITHUB_CLIENT_SECRET;

    // 1. JALUR AUTH: Dipanggil saat tombol "Login with GitHub" diklik
    if (url.pathname === '/auth') {
      const targetUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo`;
      return Response.redirect(targetUrl, 302);
    }

    // 2. JALUR CALLBACK: Dipanggil setelah Anda klik "Authorize" di GitHub
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Kode otorisasi tidak ditemukan.', { status: 400 });
      }

      // DETEKSI OTOMATIS: Memastikan apakah Cloudflare berhasil membaca Secret Anda
      if (!clientSecret) {
        return new Response('Eror: CLIENT_SECRET kosong atau tidak terbaca di Cloudflare! Periksa kembali tab Variables & Secrets Anda.', { status: 500 });
      }

      // Tukar kode verifikasi dari GitHub menjadi Access Token resmi
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'SDN3Pacung-OAuth'
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code
        })
      });

      const data = await response.json();

      if (data.error) {
        return new Response(JSON.stringify(data), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Kirim token login kembali ke halaman Decap CMS (Handshake)
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><title>Otentikasi Berhasil</title></head>
        <body>
          <script>
            function receiveMessage(e) {
              window.opener.postMessage(
                'authorization:github:success:${JSON.stringify({ token: data.access_token, provider: 'github' })}',
                e.origin
              );
            }
            window.addEventListener("message", receiveMessage, false);
            window.opener.postMessage("authorizing:github", "*");
          </script>
        </body>
        </html>
      `;
      
      return new Response(htmlContent, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return env.ASSETS.fetch(request);
  }
};