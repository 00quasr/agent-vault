import { bech32 } from 'bech32';

/**
 * Convert hex address bytes to Midnight Bech32 format
 * @param hexAddress - Hex string address from wallet API
 * @param network - 'testnet' or 'mainnet'
 * @returns Bech32-encoded Midnight address (mn_shield-addr_test1... or mn_shield-addr1...)
 */
export function hexToMidnightAddress(hexAddress: string, network: 'testnet' | 'mainnet' = 'testnet'): string {
  try {
    // Remove any 0x prefix if present
    const cleanHex = hexAddress.replace(/^0x/, '');

    // Convert hex string to bytes
    const bytes: number[] = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substr(i, 2), 16));
    }

    // Convert bytes to 5-bit words for Bech32
    const words = bech32.toWords(Buffer.from(bytes));

    // Choose prefix based on network
    const prefix = network === 'testnet' ? 'mn_shield-addr_test' : 'mn_shield-addr';

    // Encode to Bech32
    const encoded = bech32.encode(prefix, words, 1000); // 1000 is max length

    return encoded;
  } catch (error) {
    console.error('Failed to convert hex to Midnight address:', error);
    // Return original hex if conversion fails
    return hexAddress;
  }
}

/**
 * Truncate address for display (keep prefix and show first/last chars)
 * @param address - Full Midnight address
 * @returns Truncated address for UI display
 */
export function truncateMidnightAddress(address: string): string {
  if (!address) return '';

  // If it's a Midnight address (starts with mn_)
  if (address.startsWith('mn_')) {
    // Show prefix + first 8 chars + ... + last 6 chars
    const prefix = address.split('1')[0] + '1'; // Get mn_shield-addr_test1 or mn_shield-addr1
    const rest = address.substring(prefix.length);
    if (rest.length <= 14) return address; // If short enough, show all
    return `${prefix}${rest.slice(0, 8)}...${rest.slice(-6)}`;
  }

  // Fallback for hex addresses
  if (address.length > 20) {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  return address;
}
