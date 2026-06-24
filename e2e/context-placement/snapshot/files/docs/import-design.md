# Import Design

Habitat Importer converts field-team CSV files into normalized JSON
observations.

The importer writes JSON because downstream review tools do not agree on a CSV
dialect. JSON gives those tools one normalized observation format to consume.

Keep generated JSON examples out of commits when they include real site names.
