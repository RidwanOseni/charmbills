import express from 'express';
import cors from 'cors';
import { createPlanNFT } from './api/plans';
import { mintSubscriptionToken } from './api/subscriptions';
import { broadcastPackage } from './api/broadcast-package';

const app = express();
const PORT = 3001;

app.use(cors()); // Allow frontend communication [19]
app.use(express.json());

// Merchant Route: Create the Plan NFT (Authority) [19]
app.post('/api/plans/mint', createPlanNFT);

// Subscriber Route: Mint a Subscription Token [2]
app.post('/api/subscriptions/mint', mintSubscriptionToken);

// Global Route: Broadcast signed transaction packages [2]
app.post('/api/broadcast-package', broadcastPackage);

app.listen(PORT, () => console.log(`CharmBills Backend running on port ${PORT}`));
