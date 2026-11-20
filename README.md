# Đảo Đèn Lồng — Đêm 1: Đảo Bến

> 🎬 **Video demo:** _(chèn link Release v1.0.0 / `docs/demo/demo.mp4` khi có)_

Game 3D góc nhìn thứ ba (three.js). Mây, người giữ đèn nhỏ tuổi đội nón lá, gom đom đóm để thắp lại **5 Đèn Lồng Lớn** trên đảo tròn Đảo Bến, đồng thời né **Bóng Mực** trong sương đen.

## Cài đặt và chạy (3 lệnh)

```bash
npm install
npm start          # mở http://localhost:5173
npm test           # unit + scenario headless + kiểm tra tất định
```

Yêu cầu: Node ≥ 20, trình duyệt có WebGL (macOS/Linux).

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D / mũi tên | Đi (theo hướng camera) |
| Space | Nhảy (đang ở trên cao thì Bóng Mực không chạm được) |
| E | Nạp ánh sáng vào Đèn Lồng gần nhất (trong `interact_radius`) |
| F (hoặc Q) | Tỏa sáng: tốn 2 đốm, làm choáng + đẩy lùi Bóng Mực trong bán kính 6 m |
| Kéo chuột | Xoay camera |
| M | Bật/tắt nhạc · **R**: chơi lại bất cứ lúc nào |

URL debug: `?seed=N` (cố định seed), `?bot` (bot tự chơi), `?ff=S` (tua nhanh S giây bằng bot), `?autostart`.

## Luật & cách tính điểm

- Đi gần đom đóm (≤ `pickup_radius` 1.2 m) để nhặt, mang tối đa `carry_capacity` = 10.
- Mỗi đèn cần `lantern_cost` = 5 đốm; nạp được từng phần (đèn giữ lại phần đã nạp).
- Đèn đã thắp tạo vùng an toàn `safe_radius` = 5 m: Bóng Mực không vào được.
- Bị Bóng Mực chạm: mất 1 🔥 (có 3), rơi `hit_drop_ratio` = 50% số đốm đang mang (rơi ra đất, nhặt lại được), bất tử `invuln_s` = 1.5 s.
- **Thắng**: thắp đủ 5 đèn. **Thua**: hết 🔥, hoặc hết `night1_duration_s` = 300 s.

| Nguồn điểm | Điểm |
|---|---|
| Mỗi đom đóm nhặt được | +10 |
| Mỗi đèn thắp | +100 |
| Mỗi Bóng Mực bị xua (mỗi con trúng một lần tỏa sáng) | +25 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi 🔥 còn lại | +50 |

Mọi con số nằm ở `game.contract.json` → `tuning` và được cả game lẫn headless đọc trực tiếp.

## Headless (Test Contract v1.0)

```bash
node src/headless.js --scenario scenarios/win_bot.json     # in 1 dòng JSON
node src/headless.js --seed 3 --bot --events               # bot tự chơi, kèm log sự kiện
node src/headless.js --help
```

Logic ở `src/core/sim.js` (không DOM, không three.js, bước cố định 1/60 s, RNG có seed), nên **cùng đầu vào thì cùng đầu ra**. Định dạng scenario/đầu ra: xem đầu file `src/headless.js` và [docs/notes/phase1.md](docs/notes/phase1.md).

## Bằng chứng

- Bảng truy vết yêu cầu → bằng chứng: [docs/proof/README.md](docs/proof/README.md)
- Sinh lại toàn bộ: `./scripts/proof.sh` · CI: `.github/workflows/test.yml`

## Sáng tạo của tôi

Tất cả phần thêm **chỉ nằm ở lớp hiển thị** (`src/web/`), không có trong `src/core/sim.js`, nên không thể đổi đầu ra headless:

- **Thỏ Ngọc** cầm đèn ông sao lon ton theo sau Mây (chỉ trang trí).
- **Cây đa và Chú Cuội** ngồi chống gậy dưới gốc (truyện cổ tích Việt Nam).
- Chi tiết tuổi thơ: **bãi đất trống với 3 ống cống**, **con diều** bay trên dây, nhà mái ngói đỏ có cửa sổ sáng đèn.
- Đảo **sáng dần lên**: mỗi đèn thắp thì ánh sáng cam ấm mạnh hơn, trời chuyển từ xanh đêm sang tím bình minh.
- **Nhạc ru ngũ cung tự sáng tác** + hiệu ứng âm thanh tổng hợp bằng WebAudio (không dùng nhạc có bản quyền).
- Đom đóm đang mang **bay vòng quanh Mây**, nên nhìn là biết đang mang bao nhiêu.

**Bằng chứng phần lõi vẫn đúng:** 15/15 test đạt ([test-report](docs/proof/phase1/test-report.txt)); headless seed 1 + bot cho điểm **1538**, đúng bằng điểm màn thắng trong trình duyệt ([ảnh](docs/proof/img/win.png)). Tức là game có giao diện và headless dùng chung một logic.
