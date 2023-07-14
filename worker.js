const { parentPort } = require('worker_threads');
const Replicate = require('replicate');
const repli = new Replicate({auth:'your_key'});
parentPort.on('message', async ({ content, prompt, style }) => {
    try {
      const output = await repli.run(
          "nateraw/qrcode-stable-diffusion: your_key",
          {
            input: {
              prompt: prompt+ ", style: ${style}",
              qr_code_content: content
            }
          }
      );
      // Assume that the QR code image is stored in output[0]
      const qrCodeImage = output[0];
      console.log('Sending message to main thread:', qrCodeImage);
      parentPort.postMessage(qrCodeImage);
    } catch (e) {
        parentPort.postMessage({ error: e.message });
    }
  });
