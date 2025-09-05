const { ethers } = require("ethers");

// ⚠️ Thay bằng RPC & private key của bạn
const RPC_URL = "https://mainnet.shape.network";
const PRIVATE_KEY = "key";

async function clearPending() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const address = await wallet.getAddress();

  while (true) {
    const latestNonce = await provider.getTransactionCount(address, "latest");
    const pendingNonce = await provider.getTransactionCount(address, "pending");

    console.log("Latest confirmed nonce:", latestNonce);
    console.log("Next pending nonce   :", pendingNonce);

    if (pendingNonce > latestNonce) {
      const stuckNonce = latestNonce; // nonce đang bị kẹt tiếp theo
      console.log(`⚠️ Phát hiện nonce ${stuckNonce} đang pending → gửi tx 0ETH để replace...`);

      try {
        const tx = await wallet.sendTransaction({
          to: address,
          value: 0,
          nonce: stuckNonce,
          gasPrice: ethers.parseUnits("0.002", "gwei"), // gas cao hơn tx cũ
          gasLimit: 30000,
        });

        console.log("✅ Cancel tx sent:", tx.hash);
        console.log("⏳ Đợi confirm trước khi xử lý nonce tiếp theo...\n");
        await tx.wait();
      } catch (err) {
        console.error("❌ Lỗi gửi tx:", err);
        break;
      }
    } else {
      console.log("🎉 Tất cả pending nonce đã được clear!");
      break;
    }
  }
}

clearPending().catch(console.error);
