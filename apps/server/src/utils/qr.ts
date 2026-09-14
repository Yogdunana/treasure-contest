import QRCode from 'qrcode';

/**
 * Generate a QR code as a base64 data URL for the given URL.
 *
 * Uses the `qrcode` library with high error-correction level so the code
 * remains scannable even if printed at small sizes or on a noisy background.
 *
 * @param url The full URL to encode (e.g. `https://host/#/join/ABC123`).
 * @returns A `data:image/png;base64,...` string suitable for `<img src>`.
 */
export async function generateQRCode(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 320,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}
