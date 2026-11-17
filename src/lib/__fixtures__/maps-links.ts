/**
 * Link Google Maps dựng theo đúng các định dạng ghi trong `src/lib/mapsLink.ts` và README
 * (khối `data=` chỉ đường, link iOS `saddr/daddr/geocode`, một địa điểm, link rút gọn).
 * Toạ độ là chỗ thật ở miền Bắc; id địa điểm (`!1s0x…:0x…`) chỉ để giống link thật, parser bỏ qua.
 *
 * Số đếm `!<n>m<k>` phải khớp tổng số token con cháu — đếm tay ở chú thích từng link.
 */

/**
 * Hà Nội → Phủ Lý → Ninh Bình, có một điểm kéo tuyến sau Hà Nội, tránh cao tốc + thu phí,
 * đang chọn tuyến thứ 2 (`!5i1`).
 *
 *   !4m29 (outer)
 *     !4m28
 *       !1m10  Hà Nội:  !1m1!1s… (2) + !2m2!1d!2d (3) + !3m4!1m2!1d!2d!3s0 (5)
 *       !1m5   Phủ Lý:  !1m1!1s… (2) + !2m2!1d!2d (3)
 *       !1m5   Ninh Bình
 *       !2m2!1b1!2b1   (3)
 *       !3e0           (1)
 *       !5i1           (1)
 */
export const DIR_PB_THREE_STOPS =
  'https://www.google.com/maps/dir/H%C3%A0+N%E1%BB%99i/Ph%E1%BB%A7+L%C3%BD,+H%C3%A0+Nam/Ninh+B%C3%ACnh/' +
  '@20.6,105.9,10z/data=!3m1!4b1!4m29!4m28' +
  '!1m10!1m1!1s0x3135ab9bd9861ca1:0xe7887f7b72ca17a9!2m2!1d105.8341598!2d21.0277644' +
  '!3m4!1m2!1d105.8812!2d20.9003!3s0x0:0x0' +
  '!1m5!1m1!1s0x3135dfa5f2ccdd69:0x6d2a1d4b3e7f8f2c!2m2!1d105.9122!2d20.5411' +
  '!1m5!1m1!1s0x31367798e1d0c5b1:0x2f1b3e4d5c6a7b8c!2m2!1d105.9745!2d20.2506' +
  '!2m2!1b1!2b1!3e0!5i1?entry=ttu'

/**
 * Điểm đi là toạ độ trần (vị trí hiện tại) → chặng đó là `!1m0`, không có `!2m`.
 *   !4m8 (outer) → !4m7 → !1m0 (1) + !1m5 (6)
 */
export const DIR_PB_BARE_ORIGIN =
  'https://www.google.com/maps/dir/21.0075870,105.8008470/Vincom+Plaza+Long+Bi%C3%AAn/' +
  '@21.03,105.85,13z/data=!4m8!4m7!1m0!1m5!1m1!1s0x3135a9a1b2c3d4e5:0x1a2b3c4d5e6f7a8b!2m2!1d105.9161!2d21.0471'

/**
 * Ba chặng có tên nhưng khối chỉ đường chỉ ghi HAI waypoint → không khớp vị trí: toạ độ ăn lần
 * lượt vào chặng có tên, chặng thứ ba chỉ còn tên.
 *   !4m13 → !4m12 → !1m5 (6) + !1m5 (6)
 */
export const DIR_PB_MISALIGNED =
  'https://www.google.com/maps/dir/H%C3%A0+N%E1%BB%99i/Ph%E1%BB%A7+L%C3%BD/Ninh+B%C3%ACnh/' +
  '@20.6,105.9,10z/data=!4m13!4m12' +
  '!1m5!1m1!1s0x1:0x1!2m2!1d105.8341598!2d21.0277644' +
  '!1m5!1m1!1s0x2:0x2!2m2!1d105.9122!2d20.5411'

/** Link chỉ đường không có khối `!4m!4m` nhưng có `!3d!4d` (đường dự phòng bằng regex). */
export const DIR_3D4D_ONLY =
  'https://www.google.com/maps/dir/H%E1%BB%93+G%C6%B0%C6%A1m/@21.03,105.85,15z/' +
  'data=!4m5!3m4!1s0x0:0x0!8m2!3d21.0287!4d105.8524'

/** `?api=1` — dạng tài liệu chính thức. Nhiều điểm dừng ngăn bằng '|'. */
export const DIR_API1 =
  'https://www.google.com/maps/dir/?api=1&origin=21.0285,105.8542' +
  '&waypoints=Ph%E1%BB%A7+L%C3%BD|20.25,105.97&destination=Thanh+H%C3%B3a&travelmode=driving'

/** Link iOS (dạng cũ): `saddr` toạ độ, `daddr` tên, `geocode` 2 phần khớp 2 chặng. */
export const IOS_LEGACY =
  'https://maps.google.com/?saddr=21.0075870,105.8008470' +
  '&daddr=Thanh+V%C3%A2n,+Tam+%C4%90%E1%BA%A3o,+V%C4%A9nh+Ph%C3%BAc' +
  '&geocode=FeOMQAEdj2ROBg;FTxrQQEdb05OBg&dirflg=d'
/** Toạ độ mã trong phần geocode thứ hai của IOS_LEGACY. */
export const IOS_LEGACY_DEST = { lat: 21.064508, lng: 105.795183 }

/** iOS, `daddr` nối 2 điểm bằng " to:", geocode chỉ 1 phần (lệch số chặng), cờ tránh h + t. */
export const IOS_LEGACY_MULTI =
  'https://maps.google.com/?saddr=H%C3%A0+N%E1%BB%99i&daddr=Ph%E1%BB%A7+L%C3%BD+to:Ninh+B%C3%ACnh' +
  '&geocode=FeOMQAEdj2ROBg&dirflg=dht'

/** Một địa điểm: tên trong `/place/…`, toạ độ ghim `!3d!4d`, khung nhìn `@` lệch chút. */
export const PLACE =
  'https://www.google.com/maps/place/Vincom+Plaza+Long+Bi%C3%AAn/@21.0469,105.9135,17z/' +
  'data=!3m1!4b1!4m6!3m5!1s0x3135a9a1b2c3d4e5:0x1a2b3c4d5e6f7a8b!8m2!3d21.0471!4d105.9161!16s%2Fg%2F11c1q2w3e4'

/** Một địa điểm chỉ có khung nhìn `@` (không có `data=`). */
export const PLACE_VIEW_ONLY = 'https://www.google.com/maps/place/H%E1%BB%93+T%C3%A2y/@21.0545,105.8188,15z'

/** `?q=lat,lng` (link tìm kiếm). */
export const SEARCH_Q = 'https://maps.google.com/?q=20.9733,105.8468'

/** Đoạn chia sẻ từ app Google Maps Android: tên + link rút gọn, có dấu chấm cuối câu. */
export const SHARE_TEXT_SHORT = 'Vincom Plaza Long Biên\nhttps://maps.app.goo.gl/Xy7AbCdEf12GhIjK9.'
export const SHORT_LINK = 'https://maps.app.goo.gl/Xy7AbCdEf12GhIjK9'
/** Link rút gọn do app iOS chia sẻ (`?g_st=ic`). */
export const SHORT_LINK_IOS = 'https://maps.app.goo.gl/Qw3RtYuIoP9AsDfG8?g_st=ic'
