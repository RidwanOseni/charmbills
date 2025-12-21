import { Request, Response } from 'express';
import axios from 'axios';

/**
 * Satisfies the Package Submission Requirement [4, 5]
 * Equivalent to 'bitcoin-cli submitpackage'
 */
export async function handleBroadcastPackage(req: Request, res: Response) {
  const { transactions } = req.body; // Array of [commit_hex, spell_hex]

  try {
    // Call your Bitcoin Node's RPC
    const response = await axios.post(process.env.BITCOIN_RPC_URL!, {
      jsonrpc: "1.0",
      id: "broadcast",
      method: "submitpackage",
      params: [transactions]
    }, {
      auth: {
        username: process.env.RPC_USER!,
        password: process.env.RPC_PASSWORD!
      }
    });

    res.status(200).json(response.data.result);
  } catch (error) {
    res.status(500).json({ error: "Package broadcast failed" });
  }
}