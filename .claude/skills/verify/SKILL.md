---
name: verify
description: Chạy toàn bộ kiểm chứng của Đảo Đèn Lồng (test, scenario headless, tất định, ảnh chụp game) và lưu bằng chứng. Dùng trước khi báo "xong" hoặc trước khi gắn tag phase.
---
1. `npm test` — phải 0 fail. Nếu đỏ: sửa code, KHÔNG sửa test cho xanh trừ khi luật đổi (ghi lý do).
2. `./scripts/proof.sh` — sinh lại `docs/proof/phase1/*.json|txt`. Kiểm tra `determinism.txt` có `IDENTICAL`.
3. Ảnh (cần Chrome): chạy `PORT=5199 node server.js &` rồi
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=4000 --screenshot=docs/proof/img/<tên>.png "http://localhost:5199/?seed=1&autostart&ff=60"`
   (`ff=S` tua nhanh S giây bằng bot; `bot` = bot tự chơi). Mở ảnh và tự nhìn xem đúng yêu cầu chưa.
4. Cập nhật bảng truy vết trong `docs/proof/README.md` nếu có yêu cầu mới.
