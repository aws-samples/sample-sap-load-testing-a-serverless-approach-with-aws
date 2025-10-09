#!/usr/bin/env python3
"""
Script to deploy the SAP Load Tests dashboard to Grafana workspace
This script updates the dashboard JSON with the correct CloudWatch data source UID
"""

import json
import sys
import argparse
from pathlib import Path

def update_dashboard_datasource(dashboard_path: str, datasource_uid: str, output_path: str = None) -> str:
    """
    Update dashboard JSON file with the correct CloudWatch data source UID
    
    Args:
        dashboard_path: Path to the dashboard JSON file
        datasource_uid: The UID of the CloudWatch data source in Grafana
        output_path: Optional output path for the updated dashboard
    
    Returns:
        Path to the updated dashboard file
    """
    
    # Read the dashboard JSON
    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)
    
    # Update data source references
    def update_datasource_refs(obj):
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key == 'datasource' and isinstance(value, dict):
                    if value.get('type') == 'cloudwatch':
                        value['uid'] = datasource_uid
                        print(f"Updated datasource UID to: {datasource_uid}")
                elif isinstance(value, (dict, list)):
                    update_datasource_refs(value)
        elif isinstance(obj, list):
            for item in obj:
                update_datasource_refs(item)
    
    # Update all datasource references
    update_datasource_refs(dashboard)
    
    # Reset dashboard metadata for import
    dashboard['id'] = None
    dashboard['uid'] = None
    dashboard['version'] = 1
    
    # Determine output path
    if output_path is None:
        dashboard_file = Path(dashboard_path)
        output_path = dashboard_file.parent / f"{dashboard_file.stem}-updated{dashboard_file.suffix}"
    
    # Write updated dashboard
    with open(output_path, 'w') as f:
        json.dump(dashboard, f, indent=2)
    
    print(f"Updated dashboard saved to: {output_path}")
    return str(output_path)

def main():
    parser = argparse.ArgumentParser(description='Update Grafana dashboard with correct data source UID')
    parser.add_argument('dashboard_path', help='Path to the dashboard JSON file')
    parser.add_argument('datasource_uid', help='CloudWatch data source UID from Grafana')
    parser.add_argument('-o', '--output', help='Output path for updated dashboard')
    
    args = parser.parse_args()
    
    try:
        updated_path = update_dashboard_datasource(
            args.dashboard_path, 
            args.datasource_uid, 
            args.output
        )
        
        print("\n" + "="*60)
        print("Dashboard updated successfully!")
        print("="*60)
        print(f"Original: {args.dashboard_path}")
        print(f"Updated:  {updated_path}")
        print(f"Data source UID: {args.datasource_uid}")
        print("\nNext steps:")
        print("1. Go to your Grafana workspace")
        print("2. Navigate to Dashboards -> Import")
        print("3. Upload the updated dashboard file")
        print("4. Verify the CloudWatch data source is correctly mapped")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()