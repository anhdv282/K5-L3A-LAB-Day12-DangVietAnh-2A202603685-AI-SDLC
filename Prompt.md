<context>
Chúng tôi đang làm bài Lab, tôi cần phải nộp theo các file RULES.md, GUIDE.md, SUBMISSION.mddm. Tôi được yêu cầu làm game 3D tên là Đảo Đèn Lồng.

Người chơi điều khiển Mây, người giữ đèn nhỏ tuổi của một hòn đảo giữa biển mây. Đêm nay sương đen đã nuốt hết ánh sáng của đảo. Mây phải chạy khắp đảo thu thập những đốm sáng (đom đóm) rồi mang về thắp lại các Đèn Lồng Lớn.

Trong bóng tối có Bóng Mực, những sinh vật bằng mực đen sống trong sương. Chúng đuổi theo Mây; bị chúng chạm vào thì mất máu. Mây có thể tỏa sáng để xua chúng đi, nhưng việc đó tốn ánh sáng. Bóng Mực sợ những chiếc đèn.

Thắp hết đèn thì thắng. Mất hết máu thì thua. Có điểm số.
</context>

<task>
Bạn cần phải làm 1 con game, dựa vào context đề bài và các task sau:
- Một màn chơi: Đêm 1 – Đảo Bến, một hòn đảo tròn có 5 Đèn Lồng Lớn.
- Nhân vật đi lại, nhảy, camera 3D.
- Đom đóm xuất hiện rải rác trên đảo, nhặt được.
- Nạp ánh sáng vào đèn để thắp đèn.
- Bóng Mực xuất hiện và đuổi người chơi.
- Tỏa sáng để xua Bóng Mực.
- Thắng, thua, điểm số, giao diện hiển thị thông tin cần thiết (HUD).
- Có thể chơi lại sau khi thắng hoặc thua.
</task>

<requirements>
Cảm giác & phong cách:
- Không khí đêm, ấm áp, cổ tích
- Đảo sáng dần lên khi thắp đèn
- Ánh sáng vàng cam ấm là thứ tốt
- Màu tím đen là nguy hiểm
- Phong cách đồ họa đơn giản nhưng đẹp. Không cần đồ họa chân thực.
- Mây đội nón lá có treo một chiếc đèn lồng nhỏ.
- Không bạo lực, không máu me.

Nhân vật phụ:
Doraemon: lấy hình ảnh ở trên mạng và vẽ theo
Nobita: lấy hình ảnh ở trên mạng và vẽ theo

Cơ chế: cốt truyện có thể gợi ý tôiiot trong đoạn chat này.

Hiệu ứng âm thanh: cố gắng lấy theo nhạc doraemon.
Ánh sáng tươi, nhìn rõ.
Chi tiết trên đảo gắn liền với doraemon và tuổi thơ của tôi

Bóng Mực hay đom đóm khác nhau -> có thể gợi ý cho tôi nhân vật dựa theo các truyện dài của doraemon. Có thể cho tôi gợi ý

Nói rõ trong README (một mục ngắn "Sáng tạo của tôi") bạn đã thêm gì, và có bằng chứng ngắn rằng phần cũ vẫn đúng.

Không phá những gì PRD-0 và Test Contract đã yêu cầu. Phần thêm không được làm đổi đầu ra headless theo contract (ví dụ thực thể thêm nên tắt khi chạy headless).

- Sử dụng three.js 
</requirements>

<examples>
Game tốt là game đúng yêu cầu của khách hàng, không phải game phức tạp hay đẹp nhất.
Cân nhắc kỹ quota token. Đốt nhiều token không làm bài tốt hơn.
Không có bằng chứng thì chưa xong. "Agent bảo chạy rồi" không phải bằng chứng.
Chỗ PRD-0 còn mơ hồ: tự giả định hợp lý và ghi lại.
Sáng tạo thêm được khuyến khích, nhưng không được làm hỏng phần lõi và Test Contract.
</examples>

<output_format>
Game chơi được Đêm 1 từ đầu tới thắng/thua.
README.md: cách cài đặt và chạy (tối đa 3 lệnh), điều khiển, cách tính điểm của bạn.
game.contract.json và chế độ headless theo Test Contract v1.0 dưới đây.
Bằng chứng game chạy đúng yêu cầu, cùng ghi chép ngắn (giả định, nhật ký dùng AI). Định dạng tự chọn.
Harness AI bạn đã dùng (AGENTS.md hoặc tương đương, skills, hooks…).
</output_format>