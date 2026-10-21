# Luyện Chuột Pro 🎯

Ứng dụng web game giáo dục rèn luyện kỹ năng thao tác chuột máy tính kết hợp trả lời câu hỏi trắc nghiệm và điền từ dành cho học sinh.

## 🚀 Tính năng nổi bật

- **Hệ thống câu hỏi đa dạng**: Lấy trực tiếp từ Google Sheets, hỗ trợ câu hỏi trắc nghiệm và câu hỏi điền từ, có kèm ảnh minh họa.
- **Minigame luyện thao tác chuột hấp dẫn**:
  - 🟢 Kim cương xanh: Nhấn Chuột Trái (+10 điểm)
  - 🔵 Kim cương lam: Nhấn Chuột Phải (+10 điểm)
  - 🟡 Kim cương vàng: Nháy Đúp Chuột (+15 điểm)
  - 🔴 Kim cương đỏ: Kéo thả vào rương (+20 điểm, hỗ trợ cả chuột & cảm ứng)
  - 🦴 Khúc xương: Tránh va chạm (-20 điểm)
- **Báo cáo & Thống kê**: Biểu đồ trực quan (Recharts) theo dõi tiến trình của từng học sinh, tự động đồng bộ kết quả lên Google Sheets & Firebase.

## 🛠️ Công nghệ sử dụng

- **Frontend**: React 18, TypeScript, Tailwind CSS, Recharts
- **Bundler**: Vite
- **Dữ liệu**: Google Sheets API, Google Apps Script Webhook, Firebase

## 📦 Cài đặt và Chạy thử

```bash
# Cài đặt dependencies
npm install

# Chạy môi trường development
npm run dev

# Build sản phẩm
npm run build
```

## 🌐 Triển khai (Deploy)

Dự án đã được cấu hình tối ưu để triển khai trực tiếp lên **Vercel** chỉ với 1 click thông qua GitHub repository.
