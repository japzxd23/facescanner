# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **MembershipScan** - a freemium SaaS face recognition system built with React, Ionic, and TensorFlow.js. The platform provides organizations with AI-powered face recognition for member identification and attendance tracking, featuring multi-tenant architecture with API key authentication and freemium business model.

## Architecture

### Frontend Stack
- **React 18** + **TypeScript** - Main UI framework
- **Ionic React** - Mobile-first UI components and native capabilities
- **Vite** - Build tool and development server
- **TailwindCSS** - Styling framework
- **Capacitor** - Cross-platform native runtime

### AI/ML Components
- **TensorFlow.js** with WebGL backend - Face detection and processing
- **MediaPipe Face Detector** - Primary face detection model
- **Custom embedding system** - Face feature extraction using keypoints
- **Cosine similarity matching** - Face recognition algorithm (threshold: 0.91)

### Backend & Data
- **Supabase** - Backend-as-a-Service (auth, database, storage)
- **PostgreSQL** - Database with face embeddings stored as number arrays
- **Environment variables** for Supabase configuration

### Key Application Flow (SaaS Multi-Tenant)
1. **Landing Page** (`/`) - Marketing homepage with pricing and features
2. **User Authentication** (`/signup`, `/login`) - Organization account creation and login
3. **Dashboard** (`/dashboard`) - Organization management and analytics
4. **Camera Scanner** (`/camera`) - AI face detection interface (multi-tenant aware)
5. **Admin System** (`/admin`) - Legacy member management for backward compatibility
6. **Face Recognition Pipeline**: Detect → Extract embeddings → Match against stored faces → Log attendance → Apply tenant isolation

### Multi-Tenant Architecture
- **Organizations Table**: Tenant isolation with API keys and plan limits
- **Organization Users**: Account management with bcrypt password hashing
- **Member/Attendance Isolation**: All data scoped to organization ID
- **Freemium Model**: 10 members free, Pro (100 members $29/mo), Enterprise (unlimited $99/mo)
- **API Key Authentication**: For mobile apps and integrations
- **Row Level Security**: Database-level tenant isolation with Supabase RLS

## Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Linting
npm run lint

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── pages/
│   ├── CameraScanner.tsx     # Main face scanning interface
│   ├── AdminLogin.tsx        # Admin authentication
│   ├── AdminDashboard.tsx    # Admin overview
│   ├── MemberManagement.tsx  # CRUD for members
│   └── AttendanceLogs.tsx    # Attendance history
├── services/
│   ├── faceRecognition.ts    # TensorFlow.js face detection & matching
│   └── supabaseClient.ts     # Database operations & auth
└── theme/
    └── variables.css         # Ionic theme customization
```

## Database Schema

### Core Tables
- **members**: User profiles with face embeddings (`face_embedding: number[]`)
- **attendance_logs**: Timestamped check-ins with confidence scores

### Key Fields
- `face_embedding` - Normalized face feature vectors from keypoints
- `confidence` - Face match similarity score (0-1)
- `status` - Member access level: 'Allowed' | 'Banned' | 'VIP'

## Face Recognition System

### FaceRecognitionService Key Methods
- `initialize()` - Load TensorFlow.js and MediaPipe models
- `detectFaces()` - Find faces in camera feed
- `generateEmbedding()` - Extract features from face keypoints
- `matchFace()` - Compare against stored embeddings

### Configuration
- **Recognition threshold**: 0.91 similarity score
- **Backend**: WebGL for GPU acceleration
- **Model**: MediaPipe Face Detector (tfjs runtime)

## Environment Setup

Copy `.env.example` to `.env` and configure:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Mobile Deployment

The app is configured for mobile deployment via Capacitor:
- **App ID**: `com.facecheck.app`
- **Camera permissions** required for face scanning
- **Android/iOS** builds supported