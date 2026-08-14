# LIGMA Collaborative CanvaPad

A real-time collaborative canvas application with event sourcing, RBAC, and AI-powered features.

## 🚀 Features

- **Real-time Collaboration**: Multiple users can work on the same canvas simultaneously
- **Event Sourcing**: Complete audit trail of all canvas changes
- **RBAC**: Role-based access control with workspace permissions
- **AI Integration**: Groq AI for intelligent canvas suggestions
- **WebSocket Support**: Dual WebSocket architecture (Yjs CRDT + custom events)
- **Persistent Storage**: Supabase PostgreSQL backend
- **Modern Stack**: Next.js frontend + Express backend

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Supabase recommended)
- Groq API key (for AI features)

## 🛠️ Tech Stack

### Frontend
- Next.js 16
- React 18
- TypeScript
- Tailwind CSS
- Radix UI components
- Yjs for CRDT synchronization
- TanStack Query for data fetching

### Backend
- Node.js + Express
- WebSocket (ws library)
- Yjs WebSocket server
- Prisma ORM
- PostgreSQL (Supabase)
- JWT authentication
- Groq AI integration

## 📦 Project Structure

```
LIGMA_Collaborative_CanvaPad/
├── backend/                 # Express API server
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth & RBAC
│   │   ├── ws/            # WebSocket handlers
│   │   ├── db/            # Database schema & migrations
│   │   └── utils/         # Utilities
│   └── package.json
├── frontend/               # Next.js application
│   ├── app/               # App router pages
│   ├── components/        # React components
│   ├── lib/              # Utilities & hooks
│   └── package.json
├── render.yaml            # Render deployment config
└── RENDER_DEPLOYMENT.md   # Deployment guide
```

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd LIGMA_Collaborative_CanvaPad
   ```

2. **Set up the backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npx prisma generate --schema=src/db/schema.prisma
   npm start
   ```

3. **Set up the frontend**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local with your configuration
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000
   - WebSocket: ws://localhost:4000/ws
   - Yjs WebSocket: ws://localhost:4000/yjs

### Database Setup

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed database configuration.

Quick setup:
```bash
cd backend
# Run the setup script
./setup-db.sh  # Linux/Mac
# or
./setup-db.ps1  # Windows
```

## 🌐 Deployment

### Deploy to Render

This project is configured for easy deployment to Render using the included `render.yaml` blueprint.

**Quick Deploy:**
1. Push your code to GitHub
2. Connect your repository to Render
3. Render will auto-detect `render.yaml`
4. Configure environment variables
5. Deploy!

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for detailed deployment instructions.

### Environment Variables

#### Backend (.env)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_key
GROQ_API_KEY=your_groq_key
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=4000
NODE_ENV=development
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Run specific test suites
npm run test:auth
npm run test:presence
npm run test:cursor
```

## 📚 Documentation

- [Render Deployment Guide](./RENDER_DEPLOYMENT.md)
- [Supabase Setup Guide](./SUPABASE_SETUP.md)
- [Canvas Persistence Setup](./CANVAS_PERSISTENCE_SETUP.md)
- [Backend README](./backend/README.md)
- [Database Schema](./backend/src/db/schema.md)

## 🔒 Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Rate limiting on API endpoints
- CORS configuration
- Input validation
- SQL injection prevention (Prisma ORM)
- WebSocket authentication

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 🐛 Known Issues

- Free tier Render services spin down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- Local file storage is ephemeral on Render (use database for persistence)

## 🔮 Roadmap

- [ ] Real-time cursor tracking
- [ ] Canvas templates
- [ ] Export/import functionality
- [ ] Mobile responsive design
- [ ] Offline support
- [ ] Advanced AI features
- [ ] Team collaboration features

## 📧 Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review closed issues for solutions

## 🙏 Acknowledgments

- Yjs for CRDT implementation
- Supabase for database hosting
- Render for deployment platform
- Groq for AI capabilities

---

**Built with ❤️ for collaborative creativity**
