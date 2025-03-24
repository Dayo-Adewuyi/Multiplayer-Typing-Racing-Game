#!/bin/bash
ENV=${ENV:-"development"}
SERVER_PORT=${SERVER_PORT:-3001}
CLIENT_PORT=${CLIENT_PORT:-3000}
SERVER_DIR="./server"
CLIENT_DIR="./client"
BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
NC="\033[0m" 

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
SERVER_LOG="/tmp/server_$TIMESTAMP.log"
CLIENT_LOG="/tmp/client_$TIMESTAMP.log"

touch "$SERVER_LOG"
touch "$CLIENT_LOG"

print_header() {
  echo -e "\n${BOLD}${BLUE}================================================${NC}"
  echo -e "${BOLD}${BLUE}       TYPING RACE GAME - STARTUP SCRIPT         ${NC}"
  echo -e "${BOLD}${BLUE}================================================${NC}\n"
}
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
  
  if [ ! -d "$SERVER_DIR" ]; then
    echo -e "${RED}Error: Server directory '$SERVER_DIR' not found${NC}"
    exit 1
  fi
  
  if [ "$START_CLIENT" = true ] && [ ! -d "$CLIENT_DIR" ]; then
    echo -e "${YELLOW}Warning: Client directory '$CLIENT_DIR' not found${NC}"
    echo -e "Will only start the server"
    START_CLIENT=false
  fi
}
setup_environment() {
  echo -e "\n${BOLD}Setting up environment...${NC}"
  
  if [ ! -f "${SERVER_DIR}/.env" ]; then
    if [ -f "${SERVER_DIR}/.env.example" ]; then
      echo -e "Creating server .env file from example..."
      cp "${SERVER_DIR}/.env.example" "${SERVER_DIR}/.env"
    else
      echo -e "Creating default server .env file..."
      cat > "${SERVER_DIR}/.env" << EOF
PORT=${SERVER_PORT}
NODE_ENV=${ENV}
CLIENT_URL=http://localhost:${CLIENT_PORT}
MAX_PLAYERS_PER_GAME=4
COUNTDOWN_SECONDS=3
MAX_RACE_TIME_MINUTES=3
CLEANUP_DELAY_MINUTES=5
LOG_LEVEL=info
EOF
    fi
    echo -e "${GREEN}Server .env file created${NC}"
  else
    echo -e "Server .env file already exists"
  fi
  
  sed -i.bak "s/PORT=.*/PORT=${SERVER_PORT}/" "${SERVER_DIR}/.env"
  sed -i.bak "s/NODE_ENV=.*/NODE_ENV=${ENV}/" "${SERVER_DIR}/.env"
  sed -i.bak "s|CLIENT_URL=.*|CLIENT_URL=http://localhost:${CLIENT_PORT}|" "${SERVER_DIR}/.env"
  rm -f "${SERVER_DIR}/.env.bak"
  
  if [ "$START_CLIENT" = true ]; then
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
start_server() {
  echo -e "\n${BOLD}Starting server${NC} on port ${BOLD}${SERVER_PORT}${NC} in ${BOLD}${ENV}${NC} mode..."
  
  if [ "$ENV" = "production" ]; then
    (cd "$SERVER_DIR" && npm run start > "$SERVER_LOG" 2>&1 &)
  else
    (cd "$SERVER_DIR" && npm run dev > "$SERVER_LOG" 2>&1 &)
  fi
  
  SERVER_PID=$!
  echo -e "${GREEN}Server started with PID $SERVER_PID${NC}"
  echo -e "Logs available at: $SERVER_LOG"
  
  sleep 3
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}Server crashed on startup!${NC}"
    echo -e "Last 10 lines of log:"
    cat "$SERVER_LOG" 2>/dev/null || echo -e "${RED}No log data available${NC}"
    exit 1
  fi
}
start_client() {
  echo -e "\n${BOLD}Starting client${NC} on port ${BOLD}${CLIENT_PORT}${NC} in ${BOLD}${ENV}${NC} mode..."
  
  if [ "$ENV" = "production" ]; then
    (cd "$CLIENT_DIR" && npx serve -s build -l ${CLIENT_PORT} > "$CLIENT_LOG" 2>&1 &)
  else
    (cd "$CLIENT_DIR" && npm start > "$CLIENT_LOG" 2>&1 &)
  fi
  
  CLIENT_PID=$!
  echo -e "${GREEN}Client started with PID $CLIENT_PID${NC}"
  echo -e "Logs available at: $CLIENT_LOG"
  
  sleep 3
  if ! kill -0 $CLIENT_PID 2>/dev/null; then
    echo -e "${RED}Client crashed on startup!${NC}"
    echo -e "Last 10 lines of log:"
    cat "$CLIENT_LOG" 2>/dev/null || echo -e "${RED}No log data available${NC}"
    exit 1
  fi
}
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
          if [ -f "$SERVER_LOG" ]; then
            cat "$SERVER_LOG" | tail -n 20
          else
            echo -e "${RED}Server log file not found${NC}"
          fi
          echo -e "\n${BOLD}Press 'q' to quit, 's' for server logs, 'c' for client logs${NC}"
        else
          echo -e "\n${YELLOW}Server is not running${NC}"
        fi
        ;;
      c)
        if [ "$START_CLIENT" = true ]; then
          echo -e "\n${BOLD}CLIENT LOGS:${NC}"
          if [ -f "$CLIENT_LOG" ]; then
            cat "$CLIENT_LOG" | tail -n 20
          else
            echo -e "${RED}Client log file not found${NC}"
          fi
          echo -e "\n${BOLD}Press 'q' to quit, 's' for server logs, 'c' for client logs${NC}"
        else
          echo -e "\n${YELLOW}Client is not running${NC}"
        fi
        ;;
    esac
  done
}
START_SERVER=true
START_CLIENT=true
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
trap cleanup EXIT INT TERM
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
monitor_keys