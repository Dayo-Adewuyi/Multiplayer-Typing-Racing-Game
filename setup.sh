#!/bin/bash

# =========================================
# Typing Race Game Project Startup Script
# =========================================

# Set default environment
ENV=${ENV:-"development"}
SERVER_PORT=${SERVER_PORT:-3001}
CLIENT_PORT=${CLIENT_PORT:-3000}
SERVER_DIR="./server"
CLIENT_DIR="./client"
LOG_DIR="./logs"

# Text styling
BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
NC="\033[0m" # No Color

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Current timestamp for log files
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
SERVER_LOG="$LOG_DIR/server_$TIMESTAMP.log"
CLIENT_LOG="$LOG_DIR/client_$TIMESTAMP.log"

# Print header
print_header() {
  echo -e "\n${BOLD}${BLUE}================================================${NC}"
  echo -e "${BOLD}${BLUE}       TYPING RACE GAME - STARTUP SCRIPT         ${NC}"
  echo -e "${BOLD}${BLUE}================================================${NC}\n"
}

# Print usage info
print_usage() {
  echo -e "Usage: $0 [options]"
  echo -e ""
  echo -e "Options:"
  echo -e "  ${BOLD}--server-only${NC}     Start only the server"
  echo -e "  ${BOLD}--client-only${NC}     Start only the client"
  echo -e "  ${BOLD}--prod${NC}            Start in production mode"
  echo -e "  ${BOLD}--dev${NC}             Start in development mode (default)"
  echo -e "  ${BOLD}--help${NC}            Show this help message"
  echo -e ""
  echo -e "Environment variables:"
  echo -e "  ${BOLD}SERVER_PORT${NC}       Port for the server (default: 3001)"
  echo -e "  ${BOLD}CLIENT_PORT${NC}       Port for the client (default: 3000)"
  echo -e "  ${BOLD}ENV${NC}               Environment (development/production)"
  echo -e ""
  echo -e "Examples:"
  echo -e "  $0 --dev                 # Start both in development mode"
  echo -e "  $0 --server-only --prod  # Start only server in production mode"
  echo -e ""
}

# Check if Node.js is installed
check_requirements() {
  echo -e "${BOLD}Checking requirements...${NC}"
  
  if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo -e "Please install Node.js (v16 or newer recommended)"
    exit 1
  fi
  
  NODE_VERSION=$(node -v | cut -d 'v' -f 2)
  echo -e "Node.js ${GREEN}v$NODE_VERSION${NC} detected"
  
  if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
  fi
  
  NPM_VERSION=$(npm -v)
  echo -e "npm ${GREEN}v$NPM_VERSION${NC} detected"
  
  # Check if server directory exists
  if [ ! -d "$SERVER_DIR" ]; then
    echo -e "${RED}Error: Server directory '$SERVER_DIR' not found${NC}"
    exit 1
  fi
  
  # Only check for client directory if we're starting the client
  if [ "$START_CLIENT" = true ] && [ ! -d "$CLIENT_DIR" ]; then
    echo -e "${YELLOW}Warning: Client directory '$CLIENT_DIR' not found${NC}"
    echo -e "Will only start the server"
    START_CLIENT=false
  fi
}

# Setup environment
setup_environment() {
  echo -e "\n${BOLD}Setting up environment...${NC}"
  
  # Create or update .env file for server
  if [ ! -f "${SERVER_DIR}/.env" ]; then
    if [ -f "${SERVER_DIR}/.env.example" ]; then
      echo -e "Creating server .env file from example..."
      cp "${SERVER_DIR}/.env.example" "${SERVER_DIR}/.env"
    else
      echo -e "Creating default server .env file..."
      cat > "${SERVER_DIR}/.env" << EOF
# Server Configuration
PORT=${SERVER_PORT}
NODE_ENV=${ENV}

# CORS Configuration
CLIENT_URL=http://localhost:${CLIENT_PORT}

# Game Configuration
MAX_PLAYERS_PER_GAME=4
COUNTDOWN_SECONDS=3
MAX_RACE_TIME_MINUTES=3
CLEANUP_DELAY_MINUTES=5

# Logging
LOG_LEVEL=info
EOF
    fi
    echo -e "${GREEN}Server .env file created${NC}"
  else
    echo -e "Server .env file already exists"
  fi
  
  # Update environment variables in server .env
  sed -i.bak "s/PORT=.*/PORT=${SERVER_PORT}/" "${SERVER_DIR}/.env"
  sed -i.bak "s/NODE_ENV=.*/NODE_ENV=${ENV}/" "${SERVER_DIR}/.env"
  sed -i.bak "s|CLIENT_URL=.*|CLIENT_URL=http://localhost:${CLIENT_PORT}|" "${SERVER_DIR}/.env"
  rm -f "${SERVER_DIR}/.env.bak"
  
  # For the client, if required
  if [ "$START_CLIENT" = true ]; then
    # Create .env file for client if needed
    if [ ! -f "${CLIENT_DIR}/.env" ]; then
      echo -e "Creating client .env file..."
      cat > "${CLIENT_DIR}/.env" << EOF
REACT_APP_API_URL=http://localhost:${SERVER_PORT}
REACT_APP_WS_URL=ws://localhost:${SERVER_PORT}
PORT=${CLIENT_PORT}
NODE_ENV=${ENV}
EOF
      echo -e "${GREEN}Client .env file created${NC}"
    else
      # Update existing .env file for client
      if [ -f "${CLIENT_DIR}/.env" ]; then
        sed -i.bak "s|REACT_APP_API_URL=.*|REACT_APP_API_URL=http://localhost:${SERVER_PORT}|" "${CLIENT_DIR}/.env"
        sed -i.bak "s|REACT_APP_WS_URL=.*|REACT_APP_WS_URL=ws://localhost:${SERVER_PORT}|" "${CLIENT_DIR}/.env"
        sed -i.bak "s/PORT=.*/PORT=${CLIENT_PORT}/" "${CLIENT_DIR}/.env"
        sed -i.bak "s/NODE_ENV=.*/NODE_ENV=${ENV}/" "${CLIENT_DIR}/.env"
        rm -f "${CLIENT_DIR}/.env.bak"
        echo -e "Client .env file updated"
      fi
    fi
  fi
}

# Install dependencies
install_dependencies() {
  echo -e "\n${BOLD}Installing dependencies...${NC}"
  
  if [ "$START_SERVER" = true ]; then
    echo -e "${BLUE}Installing server dependencies...${NC}"
    (cd "$SERVER_DIR" && npm install) || {
      echo -e "${RED}Error installing server dependencies${NC}"
      exit 1
    }
  fi
  
  if [ "$START_CLIENT" = true ]; then
    echo -e "${BLUE}Installing client dependencies...${NC}"
    (cd "$CLIENT_DIR" && npm install --legacy-peer-deps) || {
      echo -e "${RED}Error installing client dependencies${NC}"
      exit 1
    }
  fi
}

# Build the project
build_project() {
  if [ "$ENV" = "production" ]; then
    echo -e "\n${BOLD}Building for production...${NC}"
    
    if [ "$START_SERVER" = true ]; then
      echo -e "${BLUE}Building server...${NC}"
      (cd "$SERVER_DIR" && npm run build) || {
        echo -e "${RED}Error building server${NC}"
        exit 1
      }
    fi
    
    if [ "$START_CLIENT" = true ]; then
      echo -e "${BLUE}Building client...${NC}"
      (cd "$CLIENT_DIR" && npm run build) || {
        echo -e "${RED}Error building client${NC}"
        exit 1
      }
    fi
  fi
}

# Start the server
start_server() {
  echo -e "\n${BOLD}Starting server${NC} on port ${BOLD}${SERVER_PORT}${NC} in ${BOLD}${ENV}${NC} mode..."
  
  if [ "$ENV" = "production" ]; then
    (cd "$SERVER_DIR" && npm run start > "$SERVER_LOG" 2>&1 &)
  else
    (cd "$SERVER_DIR" && npm run dev > "$SERVER_LOG" 2>&1 &)
  fi
  
  # Store the PID
  SERVER_PID=$!
  echo -e "${GREEN}Server started with PID $SERVER_PID${NC}"
  echo -e "Logs available at: $SERVER_LOG"
  
  # Wait briefly to see if the server crashes immediately
  sleep 2
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}Server crashed on startup!${NC}"
    echo -e "Last 10 lines of log:"
    tail -n 10 "$SERVER_LOG"
    exit 1
  fi
}

# Start the client
start_client() {
  echo -e "\n${BOLD}Starting client${NC} on port ${BOLD}${CLIENT_PORT}${NC} in ${BOLD}${ENV}${NC} mode..."
  
  if [ "$ENV" = "production" ]; then
    # For production, you might use serve or another static server
    (cd "$CLIENT_DIR" && npx serve -s build -l ${CLIENT_PORT} > "$CLIENT_LOG" 2>&1 &)
  else
    (cd "$CLIENT_DIR" && npm start > "$CLIENT_LOG" 2>&1 &)
  fi
  
  # Store the PID
  CLIENT_PID=$!
  echo -e "${GREEN}Client started with PID $CLIENT_PID${NC}"
  echo -e "Logs available at: $CLIENT_LOG"
  
  # Wait briefly to see if the client crashes immediately
  sleep 2
  if ! kill -0 $CLIENT_PID 2>/dev/null; then
    echo -e "${RED}Client crashed on startup!${NC}"
    echo -e "Last 10 lines of log:"
    tail -n 10 "$CLIENT_LOG"
    exit 1
  fi
}

# Handle cleanup on exit
cleanup() {
  echo -e "\n${YELLOW}Shutting down...${NC}"
  
  if [ -n "$SERVER_PID" ]; then
    echo -e "Stopping server (PID: $SERVER_PID)..."
    kill -TERM $SERVER_PID 2>/dev/null || true
  fi
  
  if [ -n "$CLIENT_PID" ]; then
    echo -e "Stopping client (PID: $CLIENT_PID)..."
    kill -TERM $CLIENT_PID 2>/dev/null || true
  fi
  
  echo -e "${GREEN}Cleanup complete${NC}"
}

# Monitor for key presses
monitor_keys() {
  echo -e "\n${BOLD}Press 'q' to quit, 's' for server logs, 'c' for client logs${NC}"
  
  while true; do
    read -rsn1 key
    case "$key" in
      q)
        cleanup
        exit 0
        ;;
      s)
        if [ "$START_SERVER" = true ]; then
          echo -e "\n${BOLD}SERVER LOGS:${NC}"
          tail -n 20 "$SERVER_LOG"
          echo -e "\n${BOLD}Press 'q' to quit, 's' for server logs, 'c' for client logs${NC}"
        else
          echo -e "\n${YELLOW}Server is not running${NC}"
        fi
        ;;
      c)
        if [ "$START_CLIENT" = true ]; then
          echo -e "\n${BOLD}CLIENT LOGS:${NC}"
          tail -n 20 "$CLIENT_LOG"
          echo -e "\n${BOLD}Press 'q' to quit, 's' for server logs, 'c' for client logs${NC}"
        else
          echo -e "\n${YELLOW}Client is not running${NC}"
        fi
        ;;
    esac
  done
}

# Default values
START_SERVER=true
START_CLIENT=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-only)
      START_CLIENT=false
      shift
      ;;
    --client-only)
      START_SERVER=false
      shift
      ;;
    --prod)
      ENV="production"
      shift
      ;;
    --dev)
      ENV="development"
      shift
      ;;
    --help)
      print_header
      print_usage
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      print_usage
      exit 1
      ;;
  esac
done

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Main execution
print_header
check_requirements
setup_environment
install_dependencies
build_project

if [ "$START_SERVER" = true ]; then
  start_server
fi

if [ "$START_CLIENT" = true ]; then
  start_client
fi

echo -e "\n${GREEN}Startup complete!${NC}"
echo -e "Server URL: ${BOLD}http://localhost:${SERVER_PORT}${NC}"
if [ "$START_CLIENT" = true ]; then
  echo -e "Client URL: ${BOLD}http://localhost:${CLIENT_PORT}${NC}"
fi

# Start monitoring for key presses
monitor_keys