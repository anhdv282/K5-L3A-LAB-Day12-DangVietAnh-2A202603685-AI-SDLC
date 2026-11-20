# Đảo Đèn Lồng — 3 Đêm

> 🎬 **Video demo:** _(chèn link Release v1.0.0 / `docs/demo/demo.mp4` khi có)_

Game 3D góc nhìn thứ ba (three.js). Mây, người giữ đèn nhỏ tuổi đội nón lá, gom đom đóm để thắp lại các Đèn Lồng Lớn qua 3 Đêm: **Đảo Bến** (5 đèn), **Đảo Cau** (2 đảo, 6 đèn), **Đảo Chuông** (3 tầng, 7 đèn). Coi chừng **Bóng Mực** và **Gió Lạc**.

## Cài đặt và chạy (3 lệnh)

```bash
npm install
npm start          # mở http://localhost:5173
npm test           # unit + scenario headless + tất định + hiệu năng
```

Yêu cầu: Node ≥ 20, trình duyệt có WebGL (macOS/Linux).

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D / mũi tên | Chạy (theo hướng camera) |
| Space | Nhảy (chỉ khi chạm đất) |
| Shift | Lướt 14 m/s trong 0.2 s, hồi 1.5 s |
| E | Nạp ánh sáng vào đèn gần nhất (≤ 2 m) |
| F (hoặc Q) | Tỏa Sáng: tốn 3 đom đóm, choáng + đẩy lùi Bóng Mực trong 5 m, hồi 3 s |
| Kéo chuột | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Esc / P | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| M | Bật/tắt nhạc |

URL debug: `?night=N&autostart` (vào thẳng Đêm N), `?seed=N`, `?bot` (bot tự chơi), `?ff=S` (tua S giây), `?fps` (hiện FPS).

## Luật & điểm (số chuẩn Ticket-02)

- Mang tối đa 10 đom đóm; tự nhặt khi cách ≤ 1 m. Mỗi đèn cần 10, nạp nhiều lần được.
- Đèn đã sáng tạo vùng an toàn 6 m mà Bóng Mực không vào được.
- Bị Bóng Mực chạm: −1 🔥, rơi một nửa số đom đóm ra quanh Mây (nhặt lại được trong 8 s), bất tử 1.5 s. Rơi khỏi đảo: −1 🔥, mất hết đom đóm, hồi sinh ở điểm xuất phát.
- Gió Lạc cướp 3 đom đóm khi Mây mang ≥ 5; Tỏa Sáng làm nó bỏ chạy hoặc thả lại đồ. Bùa Gió: chạy 7.2 m/s và lướt liên tục trong 10 s.
- **Thắng** khi thắp hết đèn; **thua** khi hết 🔥 (`no_flames`) hoặc hết giờ 300/330/360 s (`dawn`).

| Nguồn điểm | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn | +10 |
| Mỗi đèn thắp | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi con mỗi lần) | +5 |
| Khi thắng: mỗi giây còn lại | +2 |
| Khi thắng: mỗi 🔥 còn lại | +50 |

Tổng điểm game là tổng điểm các Đêm đã thắng.

## Headless (Test Contract v1.1)

```bash
node src/headless.js --night 2 --scenario scenarios/p2_drifter.json
node src/headless.js --night 3 --seed 4 --bot --snapshot-every 600
node src/headless.js --help
```

Test Contract là [game.contract.json](game.contract.json): mọi số `tuning` đều điều khiển logic (có test kiểm). Đầu ra là 1 dòng JSON gồm `result`, `reason`, `score`, `events[]`, `snapshots[]`, `final`. Định dạng tham số và JSON được mô tả ở đầu `src/headless.js` (giả định A0 trong [phase2-spec.md](docs/notes/phase2-spec.md)).

Đo FPS (cần Google Chrome): `node scripts/fps.mjs 3 20`.

## Bằng chứng & ghi chép

- Phase 2: [docs/proof/phase2/README.md](docs/proof/phase2/README.md) · spec + giả định + test bị thay: [docs/notes/phase2-spec.md](docs/notes/phase2-spec.md)
- Phase 1 (khớp tag `phase-1`): [docs/proof/README.md](docs/proof/README.md)
- Sinh lại: `./scripts/proof.sh 2` · CI: `.github/workflows/test.yml`

## Sáng tạo của tôi

Tất cả phần thêm **chỉ nằm ở lớp hiển thị** (`src/web/`), không có trong `src/core/sim.js`, nên không thể đổi đầu ra headless:

- **Thỏ Ngọc** cầm đèn ông sao lon ton theo sau Mây (chỉ trang trí).
- **Cây đa và Chú Cuội** ngồi chống gậy dưới gốc (truyện cổ tích Việt Nam).
- Chi tiết tuổi thơ: **bãi đất trống với 3 ống cống**, **con diều** bay trên dây, nhà mái ngói đỏ có cửa sổ sáng đèn.
- Đảo **sáng dần lên**: mỗi đèn thắp thì ánh sáng cam ấm mạnh hơn, trời chuyển từ xanh đêm sang tím bình minh.
- **Nhạc ru ngũ cung tự sáng tác** + hiệu ứng âm thanh tổng hợp bằng WebAudio (không dùng nhạc có bản quyền).
- Đom đóm đang mang **bay vòng quanh Mây**, nên nhìn là biết đang mang bao nhiêu.

- Phase 2: lời dẫn của **Ông Đăng** cho từng Đêm, cây cau và cầu tre ở Đảo Cau, chuông vàng trên tháp Đảo Chuông, lá bay báo gió.

**Bằng chứng phần lõi vẫn đúng:** phần thêm chỉ nằm trong `src/web/`, `src/core/` không import gì từ đó. 28/28 test đạt ([test-report](docs/proof/phase2/test-report.txt)), headless tất định trên cả 3 Đêm ([determinism](docs/proof/phase2/determinism.txt)).
