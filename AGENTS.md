# AGENTS.md — Đảo Đèn Lồng

Game 3D (three.js) + headless mode theo Test Contract v1.0. Node ≥ 20, không framework.

## Lệnh
- Cài: `npm install` · Chạy game: `npm start` → http://localhost:5173
- Test (unit + scenario + tất định): `npm test`
- Headless: `node src/headless.js --scenario scenarios/win_bot.json` (xem `--help`)
- Sinh lại bằng chứng: `./scripts/proof.sh` (ghi vào `docs/proof/phase1/`)

## Kiến trúc (bắt buộc giữ)
- `src/core/sim.js`: TOÀN BỘ luật chơi. Thuần JS, không DOM/three, không `Math.random`, bước cố định `DT=1/60`, RNG có seed.
- `src/headless.js`: chỉ đọc input → gọi sim → in 1 dòng JSON.
- `src/web/*`: chỉ vẽ + đọc phím. Thứ trang trí (đạo cụ, Thỏ Ngọc, Chú Cuội, nhạc) KHÔNG được đụng vào sim.
- Mọi con số luật lấy từ `game.contract.json` → `tuning`. Không hard-code lại.

## Quy tắc
- Không sửa tay file trong `docs/proof/`; luôn sinh lại bằng `scripts/proof.sh`.
- Không viết test luôn đạt; test phải so với công thức/hằng số từ contract.
- Đổi luật ⇒ cập nhật test + `docs/notes/` (giả định) cùng commit.
- Không dùng nhân vật/nhạc có bản quyền (RULES §8). Asset mới ghi vào `CREDITS.md`.
- Commit nhỏ, mỗi commit một việc.
