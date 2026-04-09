# FuelGuard - AI-Powered Fuel Fraud Detection

<!-- Badges -->
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green.svg)](https://nodejs.org/)

---

> **Don't get cheated at the pump.**  
> Upload your fueling video. Our AI reads the meter, frame by frame, and tells you if something's wrong.

FuelGuard is a full-stack web application that uses computer vision AI to detect fuel pump fraud in real-time. Users can upload videos of their fueling sessions, receive instant fraud analysis, generate court-admissible PDF evidence reports, and track fraudulent pumps on an interactive heatmap.

---

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool
- **Tailwind CSS** - Modern styling
- **React Router** - Client-side routing
- **Framer Motion** - Smooth animations
- **Recharts** - Data visualization
- **Leaflet** - Interactive maps & heatmaps
- **Lucide React** - Icon library

### Backend
- **Node.js** - Runtime environment
- **Express** - REST API framework
- **MongoDB** - Document database
- **Mongoose** - MongoDB ODM
- **JWT** - Secure authentication
- **bcryptjs** - Password hashing
- **Razorpay** - Payment gateway
- **Cloudinary** - Video & image storage
- **Ethers.js** - Blockchain integration (Polygon)
- **PDFKit** - PDF report generation

### AI Service
- **FastAPI** - Python microservice
- **OpenCV** - Video frame extraction
- **TensorFlow/PyTorch** - ML model inference

---

## Features

### Consumer Features
- **Video Upload & Analysis** - Upload fueling videos for instant AI fraud detection
- **Pump Reports** - Browse verified pump reports and fraud scores
- **Interactive Heatmap** - Visualize fraud hotspots across cities
- **PDF Evidence Reports** - Generate court-admissible fraud evidence documents
- **Pump Reviews & Ratings** - Community-driven pump ratings
- **Multi-language Support** - Available in English and Hindi

### Fleet Management
- **Vehicle Tracking** - Monitor fleet fuel consumption
- **Fill History** - Track every fuel fill with location data
- **Fraud Flagging** - Automatically flag suspicious fills
- **Invoice Upload** - Store and manage fuel invoices
- **Monthly Reports** - PDF fleet expense & fraud analysis reports

### Government Portal
- **Real-time Dashboard** - Overview of fraud reports and inspections
- **City Analytics** - Fraud distribution by city and company
- **Monthly Trends** - Historical fraud pattern analysis
- **Alert System** - Priority alerts for high-fraud pumps

### Business & Enterprise
- **Subscription Plans** - Free, Pro, Business, and Enterprise tiers
- **API Access** - Programmatic access for integrations
- **White-label Portal** - Custom branding options

---

## Screenshots

> **Note:** Add your application screenshots below

```
📸 Landing Page Hero Section
📸 Video Upload Interface
📸 Analysis Results Page
📸 Pump Reports Heatmap
📸 Fleet Dashboard
📸 Government Portal Dashboard
```

*Place your screenshots in `/public/images/` and update the paths above.*

---

## Installation & Setup

### Prerequisites

- Node.js 18+ installed
- MongoDB instance (local or Atlas)
- Python 3.10+ (for AI service)
- npm or yarn package manager

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/fuelguard.git
cd fuelguard
```

### 2. Environment Variables

Create `.env` files in both root and server directories:

**Root `.env`:**
```env
VITE_API_URL=http://localhost:4000
```

**Server `/server/.env`:**
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/fuelguard
JWT_SECRET=your-super-secret-jwt-key-change-in-production
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
BLOCKCHAIN_ANCHORING_ENABLED=false
POLYGON_RPC_URL=https://your-polygon-rpc-url
POLYGON_CHAIN_ID=137
POLYGON_PRIVATE_KEY=your_wallet_private_key
FASTAPI_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:5173
PAYMENTS_MODE=mock
```

### 3. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd server
npm install
```

### 4. Start the Application

**Start Backend (Terminal 1):**
```bash
cd server
npm run dev
```

**Start Frontend (Terminal 2):**
```bash
npm run dev
```

**Start AI Service (Terminal 3):**
```bash
cd ai-service
pip install -r requirements.txt
python main.py
```

### 5. Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:4000
- **AI Service:** http://localhost:8000

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/me` | Get current user |
| PATCH | `/api/auth/me` | Update user profile |
| POST | `/api/auth/forgot` | Request password reset |
| POST | `/api/auth/reset` | Reset password |

### Video Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload fueling video |
| GET | `/api/results/:jobId` | Get analysis results |
| GET | `/api/results/:jobId/pdf` | Download PDF report |

### Pump Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports` | List all pump reports |
| GET | `/api/reports/heatmap` | Get heatmap data |
| POST | `/api/report` | Submit new report |
| GET | `/api/pump/:pumpId` | Get pump details |
| POST | `/api/pump/:pumpId/review` | Add pump review |
| POST | `/api/pump/lookup` | Lookup by license |

### Fleet Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fleet/dashboard` | Fleet statistics |
| POST | `/api/fleet/vehicle` | Add vehicle |
| GET | `/api/fleet/vehicle/:reg` | Get vehicle details |
| POST | `/api/fleet/vehicle/:reg/fill` | Log fuel fill |
| GET | `/api/fleet/report` | Download fleet PDF |

### Subscriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/subscribe` | Create subscription |
| POST | `/api/subscribe/confirm` | Confirm payment |

### Government Portal
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gov/dashboard` | Government dashboard |

---

## Folder Structure

```
fuelguard/
├── public/
│   └── images/           # Application screenshots
├── server/
│   ├── uploads/         # Temporary file uploads
│   ├── node_modules/
│   ├── index.js         # Express server entry
│   ├── package.json
│   └── .env.example
├── src/
│   ├── components/      # React components
│   │   ├── landing/      # Landing page components
│   │   └── ui/          # Reusable UI components
│   ├── lib/             # Utilities & helpers
│   ├── pages/           # Page components
│   │   ├── LandingPage.tsx
│   │   ├── UploadPage.tsx
│   │   ├── ResultsPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── FleetDashboard.tsx
│   │   ├── GovPortal.tsx
│   │   └── ...
│   ├── App.tsx          # Main app component
│   ├── main.tsx        # React entry point
│   └── index.css        # Global styles
├── ai-service/          # Python AI microservice
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Future Improvements

- [ ] Real-time video streaming analysis
- [ ] Mobile app (React Native)
- [ ] Integration with more payment gateways
- [ ] Advanced ML model with higher accuracy
- [ ] Multi-country support
- [ ] IoT device integration for smart pumps
- [ ] Automated complaint filing to authorities
- [ ] Social sharing with shareable fraud cards
- [ ] SMS/WhatsApp notifications
- [ ] Dark mode for the application

---

## Contributing

Contributions are welcome! Please follow these steps:

### 1. Fork the Repository

### 2. Create a Feature Branch
```bash
git checkout -b feature/amazing-feature
```

### 3. Commit Your Changes
```bash
git commit -m "Add amazing feature"
```

### 4. Push to Branch
```bash
git push origin feature/amazing-feature
```

### 5. Open a Pull Request

Please ensure your code:
- Follows the existing code style
- Includes appropriate comments
- Passes all linting checks
- Has been tested locally

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## Support

- 📧 Email: support@fuelguard.in
- 🌐 Website: https://fuelguard.in
- 📖 Documentation: Coming soon

---

## Acknowledgments

- OpenCV & computer vision community
- Polygon blockchain for evidence anchoring
- Razorpay for seamless payments
- Cloudinary for media management

---

<div align="center">

**Built with ❤️ for a fraud-free fueling experience**

⭐ Star this repo if you find it useful!

</div>
