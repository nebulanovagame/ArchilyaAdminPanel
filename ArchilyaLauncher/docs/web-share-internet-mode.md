## Web ile Paylas - Internet Modu

Amac: Archilya Launcher host makinede calisir, musteriye sadece link gonderilir. Musteri ek program kurmadan tarayicidan baglanir.

### Neden ek TURN gerekiyor?

- `cloudflared` benzeri tunnel sadece web sayfasini disariya acar.
- Goruntu, ses ve input trafigi WebRTC ile akar.
- Yerel ag disinda WebRTC'nin stabil calismasi icin TURN gerekir.

### Desteklenen oncelik sirasi

1. Managed TURN (`ARCHILYA_TURN_URLS`, `ARCHILYA_TURN_USERNAME`, `ARCHILYA_TURN_CREDENTIAL`)
2. Local TURN (yalnizca host makinede routable public IP varsa)
3. Shared TURN fallback (`ARCHILYA_ALLOW_SHARED_TURN_FALLBACK=1` ise)

Managed TURN yoksa launcher internet paylasimini bloklar. Shared fallback sadece acikca etkinlestirilirse kullanilir.

### Gerekli ortam degiskenleri

```env
ARCHILYA_TURN_URLS=turn:your-provider.example.com:3478?transport=udp,turn:your-provider.example.com:3478?transport=tcp
ARCHILYA_TURN_USERNAME=your-username
ARCHILYA_TURN_CREDENTIAL=your-password
```

Opsiyonel:

```env
ARCHILYA_ALLOW_SHARED_TURN_FALLBACK=1
ARCHILYA_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
ARCHILYA_TUNNEL_PROVIDER=cloudflared
```

### Beklenen davranis

- Managed TURN varsa: `INTERNET HAZIR`
- Sadece shared fallback varsa: `SINIRLI HAZIR`
- TURN yoksa: `TURN GEREKLI`

### Tek tik baglanti (stream secimi olmadan)

Launcher paylasim URL'sine otomatik olarak su query parametrelerini ekler:

- `StreamerId=<session-id>`
- `AutoConnect=true`
- `AutoPlayVideo=true`

Bu sayede musteri linke tikladiginda streamer secim ekranina dusmeden dogrudan baglanir.
`session-id` her paylasim baslangicinda benzersiz uretilir ve firmalarin linklerinin birbiriyle karismasini engeller.

### Operasyon notu

- Musteri tarafinda kurulum gerekmez.
- Host makinede Archilya Launcher acik kalmalidir.
- Link gecicidir; oturum durunca veya launcher kapaninca gecersiz olur.
