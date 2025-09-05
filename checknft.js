require("dotenv").config();
const { ethers } = require("ethers");
const XLSX = require("xlsx");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = process.env.WALLET;
const contractAddress = process.env.CONTRACT;

// ==================== CẤU HÌNH CALDATA ====================
const FUNCTION_SELECTOR = "0xc0763eab"; // Selector của hàm burn (có thể đổi)
const EXPANDED_FILE = "nfts_expanded.xlsx"; // File input để generate calldata
const BATCH_SIZE = 20; // Số NFT trong mỗi batch
const OUTPUT_FILE = "result.xlsx"; // File xuất kết quả calldata
// ========================================================

// ABI ERC-1155 cơ bản
const abi = [
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
  "function balanceOf(address account, uint256 id) view returns (uint256)"
];

// Đọc NFT IDs từ file Excel
function readNFTIdsFromExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  return data.slice(1).map(row => row[0]).filter(id => id !== undefined && id !== "");
}

// Encode NFT IDs thành calldata
function encodeNFTIds(ids) {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const types = ["bytes32[]"];
  const values = [ids.map(id => {
    let hex = BigInt(id).toString(16);
    return "0x" + hex.padStart(64, "0");
  })];
  return coder.encode(types, values);
}

// Tạo calldata cho batch
function generateCalldata(nftIds) {
  const encoded = encodeNFTIds(nftIds);
  return FUNCTION_SELECTOR + encoded.slice(2);
}

async function main() {
  const contract = new ethers.Contract(contractAddress, abi, provider);

  console.log(`🔍 Đang quét các sự kiện của contract ${contractAddress} ...`);

  // Lấy sự kiện TransferSingle
  const singleEvents = await contract.queryFilter(
    contract.filters.TransferSingle(null, null, wallet),
    0,
    "latest"
  );

  // Lấy sự kiện TransferBatch
  const batchEvents = await contract.queryFilter(
    contract.filters.TransferBatch(null, null, wallet),
    0,
    "latest"
  );

  // Dùng Set để tránh trùng tokenID
  const tokenIds = new Set();

  // Thêm token từ TransferSingle
  for (const e of singleEvents) {
    const { from, to, id } = e.args;
    if (to.toLowerCase() === wallet.toLowerCase() || from.toLowerCase() === wallet.toLowerCase()) {
      tokenIds.add(id.toString());
    }
  }

  // Thêm token từ TransferBatch
  for (const e of batchEvents) {
    const { from, to, ids } = e.args;
    if (to.toLowerCase() === wallet.toLowerCase() || from.toLowerCase() === wallet.toLowerCase()) {
      ids.forEach(id => tokenIds.add(id.toString()));
    }
  }

  console.log(`🔹 Tìm thấy ${tokenIds.size} tokenID liên quan đến ví ${wallet}`);

  // Lấy số dư của từng TokenID
  const balances = [];
  for (const id of tokenIds) {
    const balance = await contract.balanceOf(wallet, id);
    if (balance > 0n) {
      balances.push({ id, quantity: Number(balance) });
    }
  }

  if (balances.length === 0) {
    console.log("⚠️ Không tìm thấy NFT nào trong ví.");
    return;
  }

  // === SẮP XẾP THEO QUANTITY GIẢM DẦN ===
  balances.sort((a, b) => a.quantity - b.quantity);

  console.log("📦 NFT ERC-1155 bạn đang sở hữu (sắp xếp theo Quantity giảm dần):");
  console.table(balances);

  // === XUẤT FILE NFTS.XLSX GỐC ===
  const data = [["Token ID", "Quantity"]];
  balances.forEach(item => {
    data.push([item.id, item.quantity]);
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, "NFTs");
  XLSX.writeFile(workbook, "nfts.xlsx");
  console.log(`✅ Đã lưu kết quả ra file nfts.xlsx (${balances.length} dòng).`);

  // === TẠO FILE NFTS_EXPANDED.XLSX ===
  const expanded = [["Token ID"]];
  balances.forEach(item => {
    if (item.quantity > 5) {
      for (let i = 0; i < item.quantity - 5; i++) {
        expanded.push([item.id]);
      }
    }
  });

  if (expanded.length > 1) {
    const expWorkbook = XLSX.utils.book_new();
    const expSheet = XLSX.utils.aoa_to_sheet(expanded);
    XLSX.utils.book_append_sheet(expWorkbook, expSheet, "Expanded");
    XLSX.writeFile(expWorkbook, EXPANDED_FILE);
    console.log(`✅ Đã lưu file ${EXPANDED_FILE} (${expanded.length - 1} dòng).`);
  } else {
    console.log("⚠️ Không có Token ID nào đủ điều kiện để nhân dòng.");
    return;
  }

  // === SINH CALDATA TỪ NFTS_EXPANDED.XLSX ===
  console.log(`\n🚀 Bắt đầu tạo calldata từ ${EXPANDED_FILE}...`);
  const allNFTIds = readNFTIdsFromExcel(EXPANDED_FILE);

  if (allNFTIds.length === 0) {
    console.error("⚠️ Không tìm thấy NFT ID nào trong file expanded!");
    return;
  }

  console.log(`📄 Đọc được ${allNFTIds.length} NFT ID từ ${EXPANDED_FILE}`);
  console.log(`🔥 Đang chia thành từng batch ${BATCH_SIZE} NFT...\n`);

  const results = [["Batch", "NFT IDs", "Calldata"]];
  let batchNumber = 1;

  for (let i = 0; i < allNFTIds.length; i += BATCH_SIZE) {
    const batch = allNFTIds.slice(i, i + BATCH_SIZE);
    const calldata = generateCalldata(batch);

    console.log(`🚀 Batch ${batchNumber} (${batch.length} NFTs):`);
    console.log(calldata + "\n");

    results.push([`Batch ${batchNumber}`, batch.join(", "), calldata]);
    batchNumber++;
  }

  const resultSheet = XLSX.utils.aoa_to_sheet(results);
  const resultWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(resultWorkbook, resultSheet, "Calldata");
  XLSX.writeFile(resultWorkbook, OUTPUT_FILE);

  console.log(`✅ Đã ghi toàn bộ calldata vào file: ${OUTPUT_FILE}`);
}

main().catch(console.error);
