#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createInterface } from 'readline';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = join(__dirname, '..');
const ROOT_DIR = join(BACKEND_DIR, '..');
const CONFIG_FILE = join(BACKEND_DIR, '.deploy-config.json');
const SAMCONFIG_FILE = join(BACKEND_DIR, 'samconfig.toml');
const ENV_FILE = join(ROOT_DIR, '.env');

const DEFAULTS = {
  region: 'us-west-2',
  stackName: 'linkedin-advanced-search',
  includeDevOrigins: true,
  productionOrigins: '',
  environment: 'prod'
};

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function exec(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', ...options });
  } catch (error) {
    if (options.ignoreError) return '';
    throw error;
  }
}

function streamExec(cmd, cwd) {
  return new Promise((resolve, reject) => {
    const [command, ...args] = cmd.split(' ');
    const proc = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
    proc.on('error', reject);
  });
}

async function checkPrerequisites() {
  console.log('\n🔍 Checking prerequisites...\n');

  try {
    exec('aws sts get-caller-identity', { stdio: 'pipe' });
    console.log('  ✅ AWS CLI configured');
  } catch {
    console.error('  ❌ AWS CLI not configured. Run "aws configure" first.');
    process.exit(1);
  }

  try {
    const samVersion = exec('sam --version', { stdio: 'pipe' }).trim();
    console.log(`  ✅ SAM CLI installed (${samVersion})`);
  } catch {
    console.error('  ❌ SAM CLI not installed. Install from https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html');
    process.exit(1);
  }

  try {
    const dockerOutput = exec('docker info', { stdio: 'pipe' });
    if (dockerOutput) {
      console.log('  ✅ Docker available');
    } else {
      console.warn('  ⚠️  Docker not running. Python Lambda builds may fail.');
    }
  } catch {
    console.warn('  ⚠️  Docker not running. Python Lambda builds may fail.');
  }

  console.log('');
}

function loadConfig() {
  if (existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
      console.log('📂 Loaded existing configuration from .deploy-config.json\n');
      return { ...DEFAULTS, ...config };
    } catch {
      console.warn('⚠️  Could not parse .deploy-config.json, using defaults\n');
    }
  }
  return { ...DEFAULTS };
}

function saveConfig(config) {
  const { openaiApiKey, openaiWebhookSecret, ...safeConfig } = config;
  writeFileSync(CONFIG_FILE, JSON.stringify(safeConfig, null, 2));
  console.log('\n💾 Configuration saved to .deploy-config.json');
}

async function promptConfig(config) {
  console.log('📝 Configuration (press Enter to accept defaults)\n');

  const region = await question(`  AWS Region [${config.region}]: `);
  if (region) config.region = region;

  const stackName = await question(`  Stack Name [${config.stackName}]: `);
  if (stackName) config.stackName = stackName;

  const environment = await question(`  Environment (dev/prod) [${config.environment}]: `);
  if (environment && ['dev', 'prod'].includes(environment)) config.environment = environment;

  const includeDevOrigins = await question(`  Include localhost CORS origins? (true/false) [${config.includeDevOrigins}]: `);
  if (includeDevOrigins) config.includeDevOrigins = includeDevOrigins === 'true';

  const productionOrigins = await question(`  Production origins (comma-separated) [${config.productionOrigins || 'none'}]: `);
  if (productionOrigins && productionOrigins !== 'none') config.productionOrigins = productionOrigins;

  console.log('\n🔐 Secrets (not persisted - will prompt each deployment)\n');

  const openaiApiKey = await question('  OpenAI API Key (press Enter to skip): ');
  if (openaiApiKey) config.openaiApiKey = openaiApiKey;

  const openaiWebhookSecret = await question('  OpenAI Webhook Secret (press Enter to skip): ');
  if (openaiWebhookSecret) config.openaiWebhookSecret = openaiWebhookSecret;

  console.log('');
  return config;
}

function generateSamconfig(config) {
  const paramOverrides = [
    `Environment=${config.environment}`,
    `IncludeDevOrigins=${config.includeDevOrigins}`
  ];

  if (config.productionOrigins) {
    paramOverrides.push(`ProductionOrigins="${config.productionOrigins}"`);
  }

  if (config.openaiApiKey) {
    paramOverrides.push(`OpenAIApiKey="${config.openaiApiKey}"`);
  }

  if (config.openaiWebhookSecret) {
    paramOverrides.push(`OpenAIWebhookSecret="${config.openaiWebhookSecret}"`);
  }

  const samconfig = `version = 0.1
[default.deploy.parameters]
stack_name = "${config.stackName}"
region = "${config.region}"
capabilities = "CAPABILITY_IAM"
resolve_s3 = true
parameter_overrides = "${paramOverrides.join(' ')}"
`;

  writeFileSync(SAMCONFIG_FILE, samconfig);
  console.log('📄 Generated samconfig.toml\n');
}

async function buildAndDeploy(config) {
  console.log('🔨 Building Lambda functions...\n');

  try {
    await streamExec('sam build --use-container', BACKEND_DIR);
  } catch (error) {
    console.error('\n❌ Build failed. Check the error above.');
    process.exit(1);
  }

  console.log('\n🚀 Deploying to AWS...\n');

  try {
    await streamExec('sam deploy --no-confirm-changeset --no-fail-on-empty-changeset', BACKEND_DIR);
  } catch (error) {
    console.error('\n❌ Deployment failed. Check the error above.');
    console.log('\n💡 Tip: If this is a new stack, ensure you have the necessary IAM permissions.');
    console.log('   If the stack is in a failed state, you may need to delete it first:');
    console.log(`   aws cloudformation delete-stack --stack-name ${config.stackName}`);
    process.exit(1);
  }

  console.log('\n✅ Deployment successful!\n');
}

async function updateEnvFile(config) {
  console.log('📤 Fetching stack outputs...\n');

  try {
    const outputs = exec(
      `aws cloudformation describe-stacks --stack-name ${config.stackName} --region ${config.region} --query "Stacks[0].Outputs" --output json`,
      { stdio: 'pipe' }
    );

    const parsedOutputs = JSON.parse(outputs);
    const outputMap = {};

    for (const output of parsedOutputs) {
      outputMap[output.OutputKey] = output.OutputValue;
    }

    let envContent = '';
    if (existsSync(ENV_FILE)) {
      envContent = readFileSync(ENV_FILE, 'utf8');
    }

    const envVars = {
      VITE_API_GATEWAY_URL: outputMap.ApiUrl || '',
      VITE_COGNITO_USER_POOL_ID: outputMap.UserPoolId || '',
      VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: outputMap.UserPoolClientId || '',
      VITE_DYNAMODB_TABLE: outputMap.DynamoDBTableName || '',
      VITE_S3_BUCKET: outputMap.ScreenshotBucketName || ''
    };

    for (const [key, value] of Object.entries(envVars)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }

    envContent = envContent.trim() + '\n';
    writeFileSync(ENV_FILE, envContent);

    console.log('✅ Updated .env with stack outputs:\n');
    for (const [key, value] of Object.entries(envVars)) {
      console.log(`  ${key}=${value}`);
    }
    console.log('');

  } catch (error) {
    console.warn('⚠️  Could not fetch stack outputs. The .env file was not updated.');
    console.log('   You may need to manually update the .env file with the following values:');
    console.log('   - VITE_API_GATEWAY_URL');
    console.log('   - VITE_COGNITO_USER_POOL_ID');
    console.log('   - VITE_COGNITO_USER_POOL_WEB_CLIENT_ID');
    console.log('   - VITE_DYNAMODB_TABLE');
    console.log('   - VITE_S3_BUCKET\n');
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   LinkedIn Advanced Search - Deployment   ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  await checkPrerequisites();

  let config = loadConfig();
  config = await promptConfig(config);

  saveConfig(config);
  generateSamconfig(config);

  await buildAndDeploy(config);
  await updateEnvFile(config);

  console.log('🎉 Deployment complete!\n');

  rl.close();
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  rl.close();
  process.exit(1);
});
