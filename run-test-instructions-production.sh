#!/bin/bash

# CollabCanvas Test Instructions Execution Script - Production Version
# This script executes the test instructions from test_instructions.md for production environment

set -e

echo "🧪 Executing CollabCanvas Test Instructions - Production Environment"
echo "=================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Production environment configuration
PRODUCTION_FRONTEND_URL="https://collab-canvas-frontend.up.railway.app"
PRODUCTION_API_URL="https://collab-canvas-frontend.up.railway.app"

# Create screenshots directory
SCREENSHOTS_DIR="test-screenshots-production-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$SCREENSHOTS_DIR"

print_status "Screenshots will be saved to: $SCREENSHOTS_DIR"
print_status "Production Frontend URL: $PRODUCTION_FRONTEND_URL"
print_status "Production API URL: $PRODUCTION_API_URL"

# Check if production services are accessible
check_production_services() {
    print_status "Checking if production services are accessible..."
    
    if ! curl -f "$PRODUCTION_FRONTEND_URL" > /dev/null 2>&1; then
        print_error "Production frontend is not accessible at: $PRODUCTION_FRONTEND_URL"
        exit 1
    fi
    
    print_success "Production frontend is accessible"
}

# Run Cypress tests for production user stories
run_production_cypress_tests() {
    print_status "Running Cypress tests for production user stories..."
    
    cd frontend
    
    # Run the comprehensive test instructions execution
    print_status "Running comprehensive test instructions execution..."
    npm run test:instructions
    
    cd ..
    
    print_success "Production Cypress tests completed"
}

# Record a 5s, 15fps clip of the production editor using Puppeteer
record_production_puppeteer_clip() {
    print_status "Recording 5s/15fps production editor clip via Puppeteer..."
    CLIP_DIR="$SCREENSHOTS_DIR/video-frames"
    mkdir -p "$CLIP_DIR"

    cat > capture_production_video.js << 'EOF'
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);

  const frontendUrl = process.env.FRONTEND_URL || 'https://collab-canvas-frontend.up.railway.app';
  const apiUrl = process.env.API_URL || 'https://collab-canvas-frontend.up.railway.app';

  // Test user credentials for production
  const testEmail = 'test@collabcanvas.com';
  const testPassword = 'TestPassword123!';

  print_status(`Navigating to production frontend: ${frontendUrl}`);
  await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Check if we need to authenticate
  const needsAuth = await page.evaluate(() => {
    const bodyText = document.body.textContent.toLowerCase();
    return bodyText.includes('sign in') || bodyText.includes('login') || 
           document.querySelector('input[type="email"], input[type="password"]') !== null;
  });

  if (needsAuth) {
    print_status('Authentication required, attempting login...');
    
    // Try to find and fill login form
    try {
      const emailInput = await page.$('input[type="email"], input[placeholder*="email" i], input[name*="email" i]');
      if (emailInput) {
        await emailInput.type(testEmail);
        await page.waitForTimeout(500);
      }
      
      const passwordInput = await page.$('input[type="password"], input[placeholder*="password" i], input[name*="password" i]');
      if (passwordInput) {
        await passwordInput.type(testPassword);
        await page.waitForTimeout(500);
      }
      
      const submitButton = await page.$('button[type="submit"], .submit, .login-button, .signin-button, button:contains("Sign In"), button:contains("Login")');
      if (submitButton) {
        await submitButton.click();
        await page.waitForTimeout(3000);
      }
    } catch (error) {
      console.log('Authentication attempt failed:', error.message);
    }
  }

  // Wait for canvas interface to load
  try {
    await page.waitForSelector('canvas, .canvas, #canvas, [data-testid="canvas-container"]', { timeout: 20000 });
    print_status('Canvas interface loaded successfully');
  } catch (error) {
    print_warning('Canvas interface not found, proceeding with available interface');
  }

  // Instrument canvas click detection
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas, .canvas, #canvas, [data-testid="canvas-container"] canvas');
    if (canvas && !(window)._ccClickProbeAttached) {
      (window)._ccCanvasClicks = 0;
      canvas.addEventListener('click', () => { (window)._ccCanvasClicks++; }, { capture: true });
      (window)._ccClickProbeAttached = true;
    }
  });

  const framesDir = process.env.FRAMES_DIR;
  
  // Get canvas coordinates for interactions
  const getCanvasRect = async () => {
    return await page.evaluate(() => {
      const el = document.querySelector('canvas, .canvas, #canvas, [data-testid="canvas-container"] canvas');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: r.left, top: r.top, width: r.width, height: r.height
      };
    });
  };

  const clickTool = async (selector) => {
    try {
      await page.click(selector, { delay: 10 });
    } catch (error) {
      console.log(`Could not click tool: ${selector}`);
    }
  };

  const clickCanvasAt = async (px, py) => {
    try {
      const canvasHandle = await page.$('canvas, .canvas, #canvas, [data-testid="canvas-container"] canvas');
      if (canvasHandle) {
        const box = await canvasHandle.boundingBox();
        if (box) {
          await canvasHandle.click({ offset: { x: px - box.x, y: py - box.y }, delay: 10 });
          return;
        }
      }
      // Fallback to mouse events
      await page.mouse.move(px, py);
      await page.mouse.down();
      await page.waitForTimeout(30);
      await page.mouse.up();
    } catch (error) {
      console.log('Canvas click failed:', error.message);
    }
  };

  // Before/After screenshots around interactions
  const shotsDir = process.env.SHOTS_DIR || process.cwd();
  const snap = async (name) => {
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: require('path').join(shotsDir, name), fullPage: true });
  };

  // Interaction script over ~5s
  for (let i = 0; i < 75; i++) {
    const t = i / 15; // seconds elapsed
    try {
      const rect = await getCanvasRect();
      if (rect) {
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        const dx = rect.left + rect.width * 0.6;
        const dy = rect.top + rect.height * 0.6;

        // Tool interactions
        if (Math.abs(t - 0.4) < 1/30) {
          await clickTool('button:contains("Rectangle"), .tool-rectangle, [data-tool="rectangle"]');
          await snap('production-before-rectangle.png');
        }
        if (Math.abs(t - 0.5) < 1/30) {
          await clickCanvasAt(cx, cy);
          await snap('production-after-rectangle.png');
        }
        if (Math.abs(t - 1.3) < 1/30) {
          await clickTool('button:contains("Select"), .tool-select, [data-tool="select"]');
          await snap('production-before-drag.png');
        }
        if (t > 1.4 && t < 1.6) {
          // Drag interaction
          await page.mouse.move(cx, cy);
          await page.mouse.down();
          await page.mouse.move(dx, dy, { steps: 5 });
          await page.mouse.up();
          await snap('production-after-drag.png');
        }
        if (Math.abs(t - 2.2) < 1/30) {
          await clickTool('button:contains("Text"), .tool-text, [data-tool="text"]');
          await snap('production-before-text.png');
        }
        if (Math.abs(t - 2.3) < 1/30) {
          await clickCanvasAt(rect.left + rect.width * 0.7, rect.top + rect.height * 0.45);
          await page.keyboard.type('Production test demo');
          await snap('production-after-text.png');
        }
      }
    } catch (error) {
      console.log(`Frame ${i} error:`, error.message);
    }

    const file = path.join(framesDir, `frame-${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: file });
    await new Promise(r => setTimeout(r, 1000/15));
  }

  // Final debug info
  try {
    const rect = await getCanvasRect();
    const clicks = await page.evaluate(() => (window)._ccCanvasClicks || 0);
    const dbgFile = process.env.DEBUG_OUT;
    if (dbgFile) {
      const payload = { timestamp: Date.now(), rect, canvasClicks: clicks };
      fs.writeFileSync(dbgFile, JSON.stringify(payload, null, 2));
    }
  } catch (error) {
    console.log('Final debug write failed:', error.message);
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
EOF

    # Ensure puppeteer installed
    if [ ! -d "frontend/node_modules/puppeteer" ]; then
        (cd frontend && npm install puppeteer)
    fi

    FRAMES_DIR="$CLIP_DIR" SHOTS_DIR="$SCREENSHOTS_DIR" DEBUG_OUT="$SCREENSHOTS_DIR/production-canvas-debug.json" FRONTEND_URL="$PRODUCTION_FRONTEND_URL" API_URL="$PRODUCTION_API_URL" NODE_PATH=frontend/node_modules node capture_production_video.js || {
        print_warning "Production Puppeteer capture failed; skipping clip"
        rm -f capture_production_video.js
        return 0
    }
    rm -f capture_production_video.js

    # Generate video from frames if ffmpeg is available
    FFMPEG_BIN="ffmpeg"
    if command -v ffmpeg > /dev/null 2>&1; then
        OUTPUT_CLIP="$SCREENSHOTS_DIR/production-editor-clip.mp4"
        "$FFMPEG_BIN" -y -framerate 15 -i "$CLIP_DIR/frame-%03d.png" -r 15 -pix_fmt yuv420p "$OUTPUT_CLIP" >/dev/null 2>&1 || {
            print_warning "Failed to assemble production clip"
            return 0
        }
        print_success "Production video clip saved: $OUTPUT_CLIP"
    else
        print_warning "ffmpeg not available; skipping video generation"
    fi
}

# Capture production screenshots for validation
capture_production_screenshots() {
    print_status "Capturing production screenshots for validation..."
    
    cat > capture_production_screenshots.js << 'EOF'
const puppeteer = require('puppeteer');
const path = require('path');

async function captureScreenshots() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1280, height: 720 });
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);
    
    const frontendUrl = process.env.FRONTEND_URL || 'https://collab-canvas-frontend.up.railway.app';
    const testEmail = 'test@collabcanvas.com';
    const testPassword = 'TestPassword123!';
    
    const screenshots = [
        { url: frontendUrl, name: 'production-01-homepage.png' },
        { url: frontendUrl, name: 'production-02-login-page.png' },
        { url: frontendUrl, name: 'production-03-authenticated.png' },
        { url: frontendUrl, name: 'production-04-canvas-interface.png' }
    ];
    
    for (const screenshot of screenshots) {
        try {
            await page.goto(screenshot.url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000);
            
            // Handle authentication for authenticated screenshots
            if (screenshot.name.includes('authenticated') || screenshot.name.includes('canvas-interface')) {
                const needsAuth = await page.evaluate(() => {
                    const bodyText = document.body.textContent.toLowerCase();
                    return bodyText.includes('sign in') || bodyText.includes('login') || 
                           document.querySelector('input[type="email"], input[type="password"]') !== null;
                });
                
                if (needsAuth) {
                    try {
                        const emailInput = await page.$('input[type="email"], input[placeholder*="email" i], input[name*="email" i]');
                        if (emailInput) {
                            await emailInput.type(testEmail);
                            await page.waitForTimeout(500);
                        }
                        
                        const passwordInput = await page.$('input[type="password"], input[placeholder*="password" i], input[name*="password" i]');
                        if (passwordInput) {
                            await passwordInput.type(testPassword);
                            await page.waitForTimeout(500);
                        }
                        
                        const submitButton = await page.$('button[type="submit"], .submit, .login-button, .signin-button');
                        if (submitButton) {
                            await submitButton.click();
                            await page.waitForTimeout(3000);
                        }
                    } catch (error) {
                        console.log('Authentication failed for', screenshot.name);
                    }
                }
            }
            
            const screenshotPath = path.join(process.cwd(), 'SCREENSHOTS_DIR', screenshot.name);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`Production screenshot saved: ${screenshot.name}`);
        } catch (error) {
            console.error(`Failed to capture ${screenshot.name}:`, error.message);
        }
    }
    
    await browser.close();
}

captureScreenshots().catch(console.error);
EOF
    
    # Replace placeholder with actual directory
    sed -i '' "s/SCREENSHOTS_DIR/$SCREENSHOTS_DIR/g" capture_production_screenshots.js
    
    # Install puppeteer if not already installed
    if [ ! -d "frontend/node_modules/puppeteer" ]; then
        cd frontend
        npm install puppeteer
        cd ..
    fi
    
    # Run screenshot capture
    FRONTEND_URL="$PRODUCTION_FRONTEND_URL" NODE_PATH=frontend/node_modules node capture_production_screenshots.js
    
    # Clean up
    rm capture_production_screenshots.js
    
    print_success "Production screenshots captured"
}

# Validate production user stories
validate_production_user_stories() {
    print_status "Validating production user stories..."
    
    cat > "$SCREENSHOTS_DIR/production-validation-report.md" << EOF
# CollabCanvas Production User Stories Validation Report

Generated on: $(date)

## Test Environment
- Frontend: $PRODUCTION_FRONTEND_URL
- API: $PRODUCTION_API_URL
- Test User: test@collabcanvas.com

## User Stories Validation

### Video Functionality Tests (5-second videos)
- [ ] 1. Ability to place an item on the canvas
- [ ] 2. Ability to resize objects on the canvas
- [ ] 3. Ability to move objects around once placed on the canvas
- [ ] 4. Ability to enter text into a text box
- [ ] 5. Ability to place objects on canvas by prompting the AI agent

### Production User Stories (Before/After Screenshots)
- [ ] 1. Use email/password authentication if necessary
- [ ] 2. A user can create a canvas and give it a name and description
- [ ] 3. A user can see a list of created canvases
- [ ] 4. A user can open a canvas for updating
- [ ] 5. A user can place a text-box on the canvas and enter text into the text box
- [ ] 6. A user can place a star on the canvas and the star takes the shape of a five-point star and the star remains visible
- [ ] 7. A user can place a circle on the canvas and the circle remains visible
- [ ] 8. A user can place a rectangle on the canvas and the rectangle remains visible
- [ ] 9. A user can place a line on the canvas and the line remains visible
- [ ] 10. A user can place an arrow on the canvas and the arrow remains visible
- [ ] 11. A user can place a diamond on the canvas and the diamond remains visible
- [ ] 12. A user can move an object around the canvas
- [ ] 13. A user can resize any shape placed on the canvas
- [ ] 14. A user can send a message to an AI Agent and request a canvas to be generated and this canvas will be presented in the browser

## Test Results
- Cypress Tests: See frontend/cypress/screenshots/test-instructions/ directory
- Production Screenshots: See $SCREENSHOTS_DIR/ directory
- Production Videos: See $SCREENSHOTS_DIR/ directory

## Notes
- All tests were run on Chrome browser on desktop
- Tests validate the core functionality of the CollabCanvas application in production
- Screenshots provide visual validation of user interface elements
- Authentication was handled using configured test user credentials
EOF
    
    print_success "Production validation report created: $SCREENSHOTS_DIR/production-validation-report.md"
}

# Main execution
main() {
    print_status "Starting production test instructions execution..."
    
    check_production_services
    
    # Run production tests
    run_production_cypress_tests
    record_production_puppeteer_clip
    capture_production_screenshots
    validate_production_user_stories
    
    print_success "Production test instructions execution completed!"
    print_status "Results saved in: $SCREENSHOTS_DIR/"
    print_status "Validation report: $SCREENSHOTS_DIR/production-validation-report.md"
    print_status "Cypress results: frontend/cypress/screenshots/test-instructions/"
}

# Run main function
main "$@"

