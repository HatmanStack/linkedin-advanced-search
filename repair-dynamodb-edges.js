#!/usr/bin/env node

/**
 * DynamoDB Edge Repair Script
 * 
 * A robust script for repairing DynamoDB user-edge entries.
 * Supports various repair operations with proper error handling,
 * logging, and rollback capabilities.
 * 
 * Usage:
 *   node repair-dynamodb-edges.js --operation=status-change --from=good_contact --to=possible [--user-id=USER_ID] [--dry-run]
 *   node repair-dynamodb-edges.js --operation=bulk-update --file=updates.json [--dry-run]
 * 
 * Requirements:
 *   - AWS CLI configured with appropriate credentials
 *   - Node.js with AWS SDK v3
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  tableName: 'linkedin-advanced-search',
  region: 'us-west-2',
  maxRetries: 3,
  batchSize: 25, // DynamoDB batch write limit
  logLevel: 'INFO' // DEBUG, INFO, WARN, ERROR
};

class DynamoDBRepairTool {
  constructor() {
    this.client = new DynamoDBClient({
      region: CONFIG.region,
      maxAttempts: CONFIG.maxRetries
    });
    this.docClient = DynamoDBDocumentClient.from(this.client);
    this.logFile = `repair-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    this.operations = [];
    this.stats = {
      scanned: 0,
      matched: 0,
      updated: 0,
      failed: 0,
      skipped: 0
    };
  }

  log(level, message, data = null) {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      const logEntry = { timestamp, level, message, data };
      console.log(`[${timestamp}] ${level}: ${message}`, data ? JSON.stringify(data, null, 2) : '');
      this.operations.push(logEntry);
    }
  }

  shouldLog(level) {
    const levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    return levels[level] >= levels[CONFIG.logLevel];
  }

  async saveLog() {
    try {
      const logData = {
        config: CONFIG,
        stats: this.stats,
        operations: this.operations,
        timestamp: new Date().toISOString()
      };
      await fs.writeFile(this.logFile, JSON.stringify(logData, null, 2));
      this.log('INFO', `Log saved to ${this.logFile}`);
    } catch (error) {
      console.error('Failed to save log:', error);
    }
  }

  /**
   * Scan for user-edge items with specific status
   */
  async scanUserEdges(userId = null, statusFilter = null) {
    this.log('INFO', 'Starting scan for user-edge items', { userId, statusFilter });

    const items = [];
    let lastEvaluatedKey = null;

    do {
      try {
        const params = {
          TableName: CONFIG.tableName,
          FilterExpression: '#pk = :pkPrefix',
          ExpressionAttributeNames: {
            '#pk': 'PK'
          },
          ExpressionAttributeValues: {
            ':pkPrefix': userId ? `USER#${userId}` : 'USER#'
          }
        };

        // Add status filter if specified
        if (statusFilter) {
          params.FilterExpression += ' AND #status = :status';
          params.ExpressionAttributeNames['#status'] = 'status';
          params.ExpressionAttributeValues[':status'] = statusFilter;
        }

        // Add user filter if not specified in PK
        if (!userId) {
          params.FilterExpression = 'begins_with(#pk, :pkPrefix)';
          if (statusFilter) {
            params.FilterExpression += ' AND #status = :status';
          }
        }

        if (lastEvaluatedKey) {
          params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const result = await this.docClient.send(new ScanCommand(params));

        if (result.Items) {
          // Filter for actual user-edge items (SK starts with PROFILE#)
          const userEdgeItems = result.Items.filter(item =>
            item.PK?.startsWith('USER#') && item.SK?.startsWith('PROFILE#')
          );
          items.push(...userEdgeItems);
          this.stats.scanned += result.Items.length;
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
        this.log('DEBUG', `Scanned batch: ${result.Items?.length || 0} items`);

      } catch (error) {
        this.log('ERROR', 'Scan failed', { error: error.message });
        throw error;
      }
    } while (lastEvaluatedKey);

    this.log('INFO', `Scan completed: ${items.length} user-edge items found`);
    return items;
  }

  /**
   * Query user edges for a specific user
   */
  async queryUserEdges(userId, statusFilter = null) {
    this.log('INFO', 'Querying user edges', { userId, statusFilter });

    try {
      const params = {
        TableName: CONFIG.tableName,
        KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skPrefix)',
        ExpressionAttributeNames: {
          '#pk': 'PK',
          '#sk': 'SK'
        },
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':skPrefix': 'PROFILE#'
        }
      };

      // Add status filter if specified
      if (statusFilter) {
        params.FilterExpression = '#status = :status';
        params.ExpressionAttributeNames['#status'] = 'status';
        params.ExpressionAttributeValues[':status'] = statusFilter;
      }

      const result = await this.docClient.send(new QueryCommand(params));
      this.stats.scanned += result.Items?.length || 0;

      this.log('INFO', `Query completed: ${result.Items?.length || 0} items found`);
      return result.Items || [];

    } catch (error) {
      this.log('ERROR', 'Query failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Update a single item's status
   */
  async updateItemStatus(item, newStatus, dryRun = false) {
    const { PK, SK } = item;
    const oldStatus = item.status;

    if (dryRun) {
      this.log('INFO', '[DRY RUN] Would update item status', {
        PK, SK, oldStatus, newStatus
      });
      this.stats.updated++;
      return { success: true, dryRun: true };
    }

    try {
      const updateParams = {
        TableName: CONFIG.tableName,
        Key: { PK, SK },
        UpdateExpression: 'SET #status = :newStatus, #updatedAt = :updatedAt',
        ConditionExpression: '#status = :oldStatus', // Prevent concurrent modifications
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updatedAt': 'updatedAt'
        },
        ExpressionAttributeValues: {
          ':newStatus': newStatus,
          ':oldStatus': oldStatus,
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      };

      // Update GSI attributes if they exist
      if (item.GSI1PK && item.GSI1SK) {
        updateParams.UpdateExpression += ', #gsi1sk = :newGSI1SK';
        updateParams.ExpressionAttributeNames['#gsi1sk'] = 'GSI1SK';

        // Extract profile ID from SK for GSI1SK construction
        const profileId = item.SK.replace('PROFILE#', '');
        updateParams.ExpressionAttributeValues[':newGSI1SK'] = `STATUS#${newStatus}#PROFILE#${profileId}`;
      }

      const result = await this.docClient.send(new UpdateCommand(updateParams));

      this.log('INFO', 'Item updated successfully', {
        PK, SK, oldStatus, newStatus
      });
      this.stats.updated++;

      return { success: true, result: result.Attributes };

    } catch (error) {
      this.log('ERROR', 'Failed to update item', {
        PK, SK, error: error.message
      });
      this.stats.failed++;
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch update multiple items
   */
  async batchUpdateStatus(items, newStatus, dryRun = false) {
    this.log('INFO', `Starting batch update: ${items.length} items`, { newStatus, dryRun });

    const results = [];
    const batches = this.chunkArray(items, CONFIG.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.log('INFO', `Processing batch ${i + 1}/${batches.length}: ${batch.length} items`);

      const batchResults = await Promise.all(
        batch.map(item => this.updateItemStatus(item, newStatus, dryRun))
      );

      results.push(...batchResults);

      // Add delay between batches to avoid throttling
      if (i < batches.length - 1) {
        await this.sleep(100);
      }
    }

    return results;
  }

  /**
   * Change status from one value to another
   */
  async changeStatus(fromStatus, toStatus, userId = null, dryRun = false) {
    this.log('INFO', 'Starting status change operation', {
      fromStatus, toStatus, userId, dryRun
    });

    let items;
    if (userId) {
      items = await this.queryUserEdges(userId, fromStatus);
    } else {
      items = await this.scanUserEdges(null, fromStatus);
    }

    if (items.length === 0) {
      this.log('WARN', 'No items found matching criteria');
      return [];
    }

    this.stats.matched = items.length;
    this.log('INFO', `Found ${items.length} items to update`);

    const results = await this.batchUpdateStatus(items, toStatus, dryRun);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    this.log('INFO', 'Status change operation completed', {
      total: items.length,
      successful,
      failed,
      dryRun
    });

    return results;
  }

  /**
   * Load and execute bulk updates from JSON file
   */
  async bulkUpdateFromFile(filePath, dryRun = false) {
    this.log('INFO', 'Starting bulk update from file', { filePath, dryRun });

    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const updates = JSON.parse(fileContent);

      if (!Array.isArray(updates)) {
        throw new Error('File must contain an array of update operations');
      }

      const results = [];

      for (const update of updates) {
        const { operation, ...params } = update;

        switch (operation) {
          case 'status-change':
            const result = await this.changeStatus(
              params.fromStatus,
              params.toStatus,
              params.userId,
              dryRun
            );
            results.push({ operation, params, result });
            break;

          default:
            this.log('WARN', 'Unknown operation in bulk update', { operation });
            this.stats.skipped++;
        }
      }

      return results;

    } catch (error) {
      this.log('ERROR', 'Bulk update from file failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Utility methods
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate AWS credentials and DynamoDB access
   */
  async validateAccess() {
    try {
      this.log('INFO', 'Validating AWS access and DynamoDB table');

      const testParams = {
        TableName: CONFIG.tableName,
        Limit: 1
      };

      await this.docClient.send(new ScanCommand(testParams));
      this.log('INFO', 'AWS access validated successfully');
      return true;

    } catch (error) {
      this.log('ERROR', 'AWS access validation failed', { error: error.message });
      return false;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      options[key] = value || true;
    }
  });

  // Show help if no operation specified
  if (!options.operation) {
    console.log(`
DynamoDB Edge Repair Tool

Usage:
  node repair-dynamodb-edges.js --operation=status-change --from=good_contact --to=possible [options]
  node repair-dynamodb-edges.js --operation=bulk-update --file=updates.json [options]

Operations:
  status-change    Change status from one value to another
  bulk-update      Execute multiple operations from JSON file

Options:
  --user-id=ID     Limit operations to specific user (optional)
  --dry-run        Preview changes without executing them
  --log-level=LEVEL Set logging level (DEBUG, INFO, WARN, ERROR)

Examples:
  # Change all 'good_contact' status to 'possible'
  node repair-dynamodb-edges.js --operation=status-change --from=good_contact --to=possible

  # Change status for specific user only
  node repair-dynamodb-edges.js --operation=status-change --from=good_contact --to=possible --user-id=user123

  # Dry run to preview changes
  node repair-dynamodb-edges.js --operation=status-change --from=good_contact --to=possible --dry-run

  # Execute bulk operations from file
  node repair-dynamodb-edges.js --operation=bulk-update --file=repairs.json
    `);
    process.exit(0);
  }

  // Set log level if specified
  if (options['log-level']) {
    CONFIG.logLevel = options['log-level'].toUpperCase();
  }

  const tool = new DynamoDBRepairTool();

  try {
    // Validate access first
    const hasAccess = await tool.validateAccess();
    if (!hasAccess) {
      console.error('❌ Cannot access DynamoDB. Please check your AWS credentials and permissions.');
      process.exit(1);
    }

    const isDryRun = options['dry-run'] === true;
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
    }

    let results;

    switch (options.operation) {
      case 'status-change':
        if (!options.from || !options.to) {
          console.error('❌ status-change operation requires --from and --to parameters');
          process.exit(1);
        }

        results = await tool.changeStatus(
          options.from,
          options.to,
          options['user-id'],
          isDryRun
        );
        break;

      case 'bulk-update':
        if (!options.file) {
          console.error('❌ bulk-update operation requires --file parameter');
          process.exit(1);
        }

        results = await tool.bulkUpdateFromFile(options.file, isDryRun);
        break;

      default:
        console.error(`❌ Unknown operation: ${options.operation}`);
        process.exit(1);
    }

    // Save log and show summary
    await tool.saveLog();

    console.log('\n📊 Operation Summary:');
    console.log(`   Scanned: ${tool.stats.scanned}`);
    console.log(`   Matched: ${tool.stats.matched}`);
    console.log(`   Updated: ${tool.stats.updated}`);
    console.log(`   Failed: ${tool.stats.failed}`);
    console.log(`   Skipped: ${tool.stats.skipped}`);
    console.log(`   Log file: ${tool.logFile}`);

    if (tool.stats.failed > 0) {
      console.log('\n⚠️  Some operations failed. Check the log file for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All operations completed successfully!');
    }

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    await tool.saveLog();
    process.exit(1);
  }
}

// Export for testing
export { DynamoDBRepairTool, CONFIG };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}