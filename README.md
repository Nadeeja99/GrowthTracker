# GrowthTracker 🌱

A comprehensive personal growth and productivity tracking application built with Next.js, designed to help you set goals, track habits, manage tasks, and analyze your progress over time.

## ✨ Features

### 🎯 Goal Management
- Set and track personal and professional goals
- Monitor progress with visual indicators
- Break down goals into manageable milestones

### 📊 Analytics & Insights
- Completion rate tracking
- Habit strength analysis
- Weekly trends visualization
- Time allocation insights
- Productivity metrics

### 📅 Schedule Management
- Daily schedule planning
- Activity templates for recurring tasks
- Calendar integration
- Time blocking capabilities

### ✅ Task Management
- Create and organize tasks
- Set priorities and due dates
- Track completion status
- Task categorization

### 📱 Responsive Design
- Mobile-first approach
- Touch-friendly interface
- Cross-device synchronization
- Progressive Web App (PWA) features

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd GrowthTracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your configuration

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Project Structure

```
GrowthTracker/
├── src/
│   ├── app/                 # Next.js app router
│   ├── components/          # React components
│   │   ├── Analytics/       # Analytics and charts
│   │   ├── Dashboard/       # Main dashboard components
│   │   ├── Goals/          # Goal management
│   │   ├── Layout/         # Navigation and layout
│   │   ├── Schedule/       # Scheduling components
│   │   ├── Tasks/          # Task management
│   │   └── ui/             # Reusable UI components
│   ├── data/               # Sample data and mock data
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions
│   └── types/              # TypeScript type definitions
├── public/                 # Static assets
└── tailwind.config.ts      # Tailwind CSS configuration
```

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Chart.js with react-chartjs-2
- **State Management**: React hooks + localStorage
- **PWA**: Service workers and manifest
- **Deployment**: Vercel-ready

## 📱 Usage Guide

### Dashboard
- View your daily focus areas
- Check quick stats and progress
- Access weekly overview

### Goals
- Create new goals with descriptions
- Set target dates and priorities
- Track progress visually

### Schedule
- Plan your daily activities
- Use templates for recurring tasks
- Manage time blocks effectively

### Tasks
- Add new tasks with details
- Organize by priority and category
- Mark tasks as complete

### Analytics
- Review completion rates
- Analyze habit strength
- View productivity trends
- Monitor time allocation

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

### Code Style
- ESLint configuration for code quality
- Prettier for consistent formatting
- TypeScript for type safety

## 📦 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect Next.js
3. Deploy with zero configuration

### Manual Deployment
```bash
npm run build
npm run start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Next.js and React
- Styled with Tailwind CSS
- Charts powered by Chart.js
- Icons from various icon libraries

## 📞 Support

If you have any questions or need help:
- Open an issue on GitHub
- Check the documentation
- Review the code examples

---

**Happy tracking! 🚀**
