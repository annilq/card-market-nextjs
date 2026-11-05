import * as migration_20261101_071941_init from './20261101_071941_init';
import * as migration_20261101_080000_search_indexes from './20261101_080000_search_indexes';
import * as migration_20261103_154633 from './20261103_154633';
import * as migration_20261104_000000_perf_indexes from './20261104_000000_perf_indexes';
import * as migration_20261104_104939 from './20261104_104939';
import * as migration_20261104_221900_role_phone_forcepass from './20261104_221900_role_phone_forcepass';
import * as migration_20261105_000000_fix_forcepass_column from './20261105_000000_fix_forcepass_column';

export const migrations = [
  {
    up: migration_20261101_071941_init.up,
    down: migration_20261101_071941_init.down,
    name: '20261101_071941_init',
  },
  {
    up: migration_20261101_080000_search_indexes.up,
    down: migration_20261101_080000_search_indexes.down,
    name: '20261101_080000_search_indexes',
  },
  {
    up: migration_20261103_154633.up,
    down: migration_20261103_154633.down,
    name: '20261103_154633',
  },
  {
    up: migration_20261104_000000_perf_indexes.up,
    down: migration_20261104_000000_perf_indexes.down,
    name: '20261104_000000_perf_indexes',
  },
  {
    up: migration_20261104_104939.up,
    down: migration_20261104_104939.down,
    name: '20261104_104939',
  },
  {
    up: migration_20261104_221900_role_phone_forcepass.up,
    down: migration_20261104_221900_role_phone_forcepass.down,
    name: '20261104_221900_role_phone_forcepass',
  },
  {
    up: migration_20261105_000000_fix_forcepass_column.up,
    down: migration_20261105_000000_fix_forcepass_column.down,
    name: '20261105_000000_fix_forcepass_column',
  },
];
