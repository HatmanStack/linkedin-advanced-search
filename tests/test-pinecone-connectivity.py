#!/usr/bin/env python3
"""
Simple Pinecone Connectivity Test

Quick test to verify:
1. Pinecone API key works
2. Index is accessible
3. Basic operations work

Usage:
    export PINECONE_API_KEY=your_key_here
    python test-pinecone-connectivity.py
"""

import os
from pinecone import Pinecone

# Configuration
PINECONE_API_KEY = os.environ.get('PINECONE_API_KEY')
PINECONE_HOST = 'linkedin-profiles-86mgnt0.svc.aped-4627-b74a.pinecone.io'
PINECONE_INDEX_NAME = 'linkedin-profiles'

def test_pinecone_connectivity():
    """Test basic Pinecone connectivity"""
    print("🔍 Testing Pinecone Connectivity")
    print("=" * 40)
    
    if not PINECONE_API_KEY:
        print("❌ PINECONE_API_KEY environment variable not set")
        print("   Run: export PINECONE_API_KEY=your_key_here")
        return False
    
    try:
        # Initialize client
        print("🔌 Initializing Pinecone client...")
        pc = Pinecone(api_key=PINECONE_API_KEY)
        
        # Connect to index
        print("📊 Connecting to index...")
        index = pc.Index(host=PINECONE_HOST)
        
        # Get index stats
        print("📈 Getting index statistics...")
        stats = index.describe_index_stats()
        
        print("✅ Connection successful!")
        print(f"   - Index: {PINECONE_INDEX_NAME}")
        print(f"   - Total vectors: {stats.get('total_vector_count', 0)}")
        print(f"   - Dimension: {stats.get('dimension', 'Unknown')}")
        print(f"   - Namespaces: {list(stats.get('namespaces', {}).keys())}")
        
        # Test a simple upsert with integrated embedding
        print("\n🧪 Testing integrated embedding...")
        test_record = {
            '_id': 'test-connectivity-123',
            'summary': 'This is a test record for connectivity verification.',
            'test_field': 'connectivity_test'
        }
        
        index.upsert_records(namespace="default", records=[test_record])
        print("✅ Test record upserted successfully")
        
        # Test search using Python SDK's search method
        print("🔍 Testing search...")
        search_results = index.search(
            namespace="default",
            query={
                'top_k': 1,
                'inputs': {'text': 'test connectivity'}
            }
        )
        
        matches = search_results.get('matches', [])
        print(f"✅ Search returned {len(matches)} results")
        
        # Cleanup test record
        print("🧹 Cleaning up test record...")
        index.delete(namespace="default", ids=['test-connectivity-123'])
        print("✅ Test record cleaned up")
        
        print("\n🎉 All connectivity tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Connectivity test failed: {str(e)}")
        return False

def main():
    """Main execution"""
    success = test_pinecone_connectivity()
    
    if success:
        print("\n✅ Pinecone is ready for integration!")
    else:
        print("\n❌ Fix connectivity issues before proceeding.")
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())
