require("dotenv").config();
const { ethers } = require("ethers");
const xlsx = require("xlsx");

// ===== Load cấu hình từ .env =====
const RPC_URL = process.env.RPC_URL;
const PRIVATEKEY = process.env.PRIVATEKEY;
const SMARTCONTRACT = process.env.SMARTCONTRACT;

// Kiểm tra biến môi trường
if (!RPC_URL || !PRIVATEKEY || !SMARTCONTRACT) {
    console.error("❌ Lỗi: Vui lòng kiểm tra lại file .env! Thiếu RPC_URL, PRIVATEKEY hoặc SMARTCONTRACT.");
    process.exit(1);
}

// ===== Hàm gửi giao dịch cho 1 batch =====
async function sendTransactionBatch(batch, provider, wallet) {
    const promises = batch.map(async (hexData, idx) => {
        const tx = {
            to: SMARTCONTRACT,
            value: 0,
            data: hexData,
            gasLimit: 1_500_000,
            maxPriorityFeePerGas: ethers.parseUnits("0.000014", "gwei"),
            maxFeePerGas: ethers.parseUnits("0.0014", "gwei"),
        };

        try {
            const txResponse = await wallet.sendTransaction(tx);
            console.log(`✅ Gửi thành công TX ${idx + 1} trong batch: ${txResponse.hash}`);
        } catch (error) {
            console.error(`❌ Lỗi gửi TX ${idx + 1} trong batch:`, error.message);
        }
    });

    await Promise.all(promises);
}

// ===== Hàm delay =====
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTransaction() {
    // Tạo provider và wallet từ .env
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATEKEY, provider);

    // Đọc file result.xlsx
    const workbook = xlsx.readFile("result.xlsx");
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Lấy hexData từ cột C, bắt đầu từ C2
    const hexList = data.slice(1).map(row => row[2]).filter(Boolean);

    if (hexList.length === 0) {
        console.error("⚠️ Không tìm thấy hex data trong result.xlsx!");
        return;
    }

    console.log(`📄 Đọc ${hexList.length} hex data từ result.xlsx`);
    const batchSize = 1; // Mỗi batch 1 hex, có thể chỉnh thành 5, 10...

    for (let i = 0; i < hexList.length; i += batchSize) {
        const batch = hexList.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        console.log(`🚀 Đang xử lý batch ${batchNumber} (${batch.length} giao dịch)`);
        await sendTransactionBatch(batch, provider, wallet);

        // Delay 30 giây giữa các batch (trừ batch cuối)
        if (i + batchSize < hexList.length) {
            console.log(`⏳ Đợi 20 giây trước khi chạy batch tiếp theo...\n`);
            await delay(8000);
        }
    }

    console.log("🎉 Hoàn tất gửi tất cả giao dịch!");
}

sendTransaction();
