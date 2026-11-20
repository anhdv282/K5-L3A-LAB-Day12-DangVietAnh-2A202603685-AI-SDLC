# AGENTS.md — Đảo Đèn Lồng

Game 3D (three.js), 3 Đêm, Test Contract = `game.contract.json` (v1.3). Node ≥ 20, không framework.

## Lệnh
- Cài: `npm install` · Chạy game: `npm start` → http://localhost:5173
- Test (unit + scenario + tất định): `npm test`
- Headless: `node src/headless.js --night 2 --scenario scenarios/p2_drifter.json` (xem `--help`)
- Sinh lại bằng chứng: `./scripts/proof.sh 4` (ghi vào `docs/proof/phase4/`) 
- Bench: `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` · Soak: `npm run soak` · Trình duyệt: `node scripts/e2e.mjs`

## Ba điều bắt buộc + bản quyền
1. **Game đúng yêu cầu**: khách chấm theo yêu cầu đã nêu, không chấm độ lung linh. Làm đúng và chứng minh được trước, trau chuốt sau.
2. **Cân nhắc quota token**: ngữ cảnh gọn, kế hoạch rõ, kiểm chứng sớm. Không chạy agent liên tục, không thêm việc ngoài yêu cầu.
3. **Kiểm chứng là sống còn**: bằng chứng (test, output headless, số đo, ảnh/clip) mới tính là xong; lời mô tả không tính.
4. **Asset bên ngoài** chỉ dùng loại CC0 / CC-BY / MIT hoặc tự tạo, ghi nguồn trong `CREDITS.md`. Không nhân vật/nhạc/thương hiệu có bản quyền.

## Tách tầng: Render Loop vs Game State Logic (bắt buộc)
Logic game phải chạy độc lập với thư viện đồ họa để phục vụ headless Test Contract. Logic dính vào cửa sổ ⇒ không chạy được test tự động.
- `src/core/` và `src/headless.js` KHÔNG import `three`, `src/web/*`, và không dùng `window`/`document`/`requestAnimationFrame`/`localStorage`/`Math.random`/`Date.now`/`performance.now`/timer.
- Mọi luật (di chuyển, va chạm, điểm, thắng/thua, lịch sinh, chuỗi Đêm/tổng điểm) nằm trong `src/core/`. `src/web/` chỉ: đọc phím → input, gọi `sim.step()` theo bước cố định, vẽ state, phát âm thanh theo `events`.
- Render loop chạy theo khung hình; logic chạy theo tick cố định 1/60 s (accumulator). Không để FPS ảnh hưởng kết quả logic.

## Kiến trúc (bắt buộc giữ)
- `src/core/sim.js`: TOÀN BỘ luật chơi. Thuần JS, không DOM/three, không `Math.random`, 60 tick/s, mọi bộ đếm là tick nguyên, RNG có seed.
  `step()` phải giữ **đúng 12 bước theo thứ tự Ticket-02** (đánh số trong code). Đừng gộp/đảo bước.
- `src/core/maps.js`: dữ liệu 3 bản đồ chuẩn + `groundHeight()`. Tọa độ/góc lấy nguyên văn từ ticket.
- `src/headless.js`: chỉ đọc input → gọi sim → in 1 dòng JSON.
- `src/web/*`: chỉ vẽ + đọc phím. Thứ trang trí (đạo cụ, Thỏ Ngọc, Chú Cuội, nhạc) KHÔNG được đụng vào sim.
- Mọi khóa `tuning` trong `game.contract.json` PHẢI được `sim.js` đọc (test `contract sync` sẽ đỏ nếu không); số chuẩn khác của ticket là hằng có tên ở đầu `sim.js`.
- Số liệu/bản đồ/Test Contract là yêu cầu của khách: KHÔNG tự đổi. Chỗ mơ hồ: ghi giả định vào `docs/notes/phase2-spec.md` rồi hỏi người dùng.

## Quy tắc
- Không sửa tay file trong `docs/proof/`; luôn sinh lại bằng `scripts/proof.sh`.
- Không viết test luôn đạt; test phải so với công thức/hằng số từ contract.
- Đổi luật ⇒ cập nhật test + `docs/notes/` (giả định) cùng commit. Test cũ bị thay: sửa và ghi lý do trong bảng "Test bị thay", không tắt.
- Mỗi tính năng mới cần ≥ 1 scenario headless trong `tests/phase2.test.js` hoặc `scenarios/`.
- **Chống hồi quy:** scenario của phase cũ được chép nguyên văn vào `tests/fixtures/phaseN/` và phải luôn chạy được (`tests/phase1-regression.test.js`). Không xóa/đổi định dạng headless cũ; chỉ mở rộng (đầu ra là tập cha).
- **Luật bị thay (change request):** ghi ADR trong `docs/adr/`, breaking changes trong `CHANGELOG.md`; test cũ sửa kèm nhãn `[Ticket-NN]` + lý do ngay trong test. Không skip, không xóa âm thầm.
- Dầu đèn lưu bằng số nguyên đơn vị 1/60 (`fuelUnits`); không dùng float cho bộ đếm luật.
- **Kiểm chứng trước khi code:** viết test cho yêu cầu mới, chạy thấy đỏ, lưu kết quả đỏ, rồi mới code.
- Bài học: khi test đỏ, kiểm tra **kỳ vọng của test** trước (đã 3 lần test sai: khoảng cách, off-by-one tick) rồi mới sửa luật.
- Cảnh benchmark phải tắt mọi thứ sáng tạo (`BENCH_MODE`) và không đổi luật; `bench.json`/`soak.json` chỉ do script sinh, không sửa tay.
- Không dùng nhân vật/nhạc có bản quyền (RULES §8). Asset mới ghi vào `CREDITS.md`.
- Commit nhỏ, mỗi commit một việc.
