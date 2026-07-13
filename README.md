# 🏋️ Sanogich — AI Mashq Sanagich

Kamera orqali mashqlarni **avtomatik sanaydigan** veb-ilova. Telefon yoki kompyuter brauzerida ishlaydi — hech narsa o'rnatish shart emas.

## Imkoniyatlar

- 💪 **Push-up** — tirsak burchagi orqali sanaydi
- 🦵 **Prised (squat)** — tizza burchagi orqali sanaydi
- 🧘 **Press (sit-up)** — tana burchagi orqali sanaydi
- 🏋️ **Bitseps (curl)** — qo'l bukilishi orqali sanaydi
- 🤸 **Jumping Jack** — qo'l va oyoq holati orqali sanaydi

Qo'shimcha:

- 🔊 Har takrorda ovozli signal, har 10-takrorda sonni aytib beradi
- 📊 Jami takror, vaqt va taxminiy kaloriya statistikasi
- 🔃 Old/orqa kamerani almashtirish
- 🎯 Skelet chizig'i — tanangiz qanday aniqlanayotganini ko'rasiz
- 🔒 **Maxfiylik**: barcha hisob-kitoblar qurilmangizning o'zida bajariladi, video hech qayerga yuborilmaydi

## Qanday ishlaydi?

Ilova [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) AI modelidan foydalanadi — kameradagi tasvirdan tananing 33 ta nuqtasini (yelka, tirsak, tizza va h.k.) aniqlaydi. Keyin bo'g'imlar orasidagi burchaklar hisoblanadi va har bir mashq uchun holat mashinasi (pastda → tepada = 1 takror) ishlaydi.

## Ishga tushirish

Bu oddiy statik sayt — istalgan veb-serverda ishlaydi:

```bash
# Lokal sinash uchun:
python3 -m http.server 8000
# keyin brauzerda: http://localhost:8000
```

Yoki **GitHub Pages** orqali bepul joylashtiring: repozitoriy sozlamalarida *Settings → Pages → Deploy from a branch* ni tanlang.

> ⚠️ Kamera faqat **HTTPS** yoki `localhost` da ishlaydi (brauzer xavfsizlik talabi). GitHub Pages avtomatik HTTPS beradi.

## Foydalanish bo'yicha maslahatlar

| Mashq | Kamera joylashuvi |
|---|---|
| Push-up | Yon tomondan, tana to'liq ko'rinsin |
| Prised | Old yoki yon tomondan, to'liq bo'y |
| Press | Yon tomondan, yotgan holat ko'rinsin |
| Bitseps | Old tomondan, qo'llar ko'rinsin |
| Jumping Jack | Old tomondan, to'liq bo'y |

- Yorug' joyda mashq qiling
- Kameradan 2–3 metr uzoqlikda turing
- Birinchi ochilishda AI model yuklanishi ~10 soniya vaqt oladi (keyin keshda saqlanadi)

## Texnologiyalar

- [MediaPipe Tasks Vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) — pose aniqlash (WebAssembly + GPU)
- Vanilla JavaScript, HTML, CSS — hech qanday build kerak emas
