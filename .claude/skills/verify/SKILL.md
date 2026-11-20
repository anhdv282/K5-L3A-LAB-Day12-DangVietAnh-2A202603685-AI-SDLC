---
name: verify
description: Chạy toàn bộ kiểm chứng của Đảo Đèn Lồng (test, scenario headless, tất định, ảnh chụp game) và lưu bằng chứng. Dùng trước khi báo "xong" hoặc trước khi gắn tag phase.
---
1. `npm test` — phải 0 fail, gồm cả `phase1-regression` (scenario phase cũ) và `architecture` (tách tầng). Nếu đỏ: sửa code, KHÔNG sửa test cho xanh trừ khi luật đổi (ghi lý do).
2. `./scripts/proof.sh 3` — sinh lại `docs/proof/phase3/*` (scenario, tất định 3 Đêm, perf, kết quả bot). Kiểm tra `determinism.txt` toàn `IDENTICAL`, `perf.txt` < 30000 ms.
3. Ảnh (cần Chrome): chạy `PORT=5199 node server.js &` rồi
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=4000 --screenshot=docs/proof/img/<tên>.png "http://localhost:5199/?shot&night=2&autostart&seed=1&ff=40"`
   (`night=N` chọn Đêm, `ff=S` tua nhanh S giây bằng bot, `bot` bot tự chơi, `fps` hiện FPS, `shot` giữ buffer để chụp). Ảnh lưu `docs/proof/phase3/img/`. `cb` bật chế độ mù màu. Mở ảnh và tự nhìn xem đúng yêu cầu chưa.
4. FPS (cần Chrome): `node scripts/fps.mjs 3 20 >> docs/proof/phase2/fps.txt`. Kiểm `renderer` là GPU thật (không phải SwiftShader) và `size` = 1280x720.
5. Cập nhật bảng truy vết `docs/proof/phase3/README.md`. Mục chưa có bằng chứng ghi **Chưa đạt/Chưa đo**, không ghi Đạt.
