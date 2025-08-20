# Shape OTOM auto burn nfts to get energy

Cài Node js

- [Node.js](https://nodejs.org/) (v14 or higher)
- npm (Node Package Manager)

## Git clone các file cần thiết về:

1. Clone the repository:

   ```bash
   git clone https://github.com/voztoy/otom_burn_nft.git
   cd otom_burn_nft
   ```

2. Install mudule cần thiết

   ```bash
   npm install
   npm init -y
   npm install ethers dotenv xlsx
   ```

3. Tạo file .env có cấu trúc:

   ```bash
   RPC_URL=https://mainnet.shape.network
   WALLET=0x....
   PRIVATEKEY=0x....
   CONTRACT=0x2f9810789aebBB6cdC6c0332948fF3B6D11121E3// contract để kiểm tra số dư ID
   SMARTCONTRACT=0xca3088aedaAB138cAB3F0c135ceD77aF1a8b9063// Contract để burn nft
   ```


## Kiểm tra NFTS otom

Run the script

   ```bash
   node checknft.js
   ```
Kết quả đẻ ra 3 file: 
- nfts.xlsx: chứa list ID và số lượng tương ứng
- nfts_expanded.xlsx: chứa list ID đã được nhân bản theo số lượng
- result.xlsx: chứa hexdata dùng để burn nft, hex đã được convert từ 20 ID liên tiếp. Hex được tạo để chỉ burn những ID có số lượng trên 5 và burn phần trên 5, giữ lại ID có số lượng từ 5 trở xuống (để còn đi ghép nguyên tử)

## Gửi lệnh burn nfts

Run the script

   ```bash
   node index.js
   ```

Node sẽ gửi tx burn ứng với hexdata ở result.xlsx

