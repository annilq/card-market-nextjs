import * as migration_20261101_071941_init from './20261101_071941_init';
import * as migration_20261101_080000_search_indexes from './20261101_080000_search_indexes';
import * as migration_20261103_154633 from './20261103_154633';
import * as migration_20261104_000000_perf_indexes from './20261104_000000_perf_indexes';
import * as migration_20261104_104939 from './20261104_104939';
import * as migration_20261104_221900_role_phone_forcepass from './20261104_221900_role_phone_forcepass';
import * as migration_20261105_000000_fix_forcepass_column from './20261105_000000_fix_forcepass_column';
import * as migration_20261105_020000_roles_permission_model from './20261105_020000_roles_permission_model';
import * as migration_20261105_030000_fix_roles_permissions_cols from './20261105_030000_fix_roles_permissions_cols';
import * as migration_20261105_040000_fix_roles_permissions_id from './20261105_040000_fix_roles_permissions_id';
import * as migration_20261106_050000_add_roles_id_to_locked_docs_rels from './20261106_050000_add_roles_id_to_locked_docs_rels';
import * as migration_20261110_221000_card_statuses from './20261110_221000_card_statuses';
import * as migration_20261110_234500_no_deduction_buyback from './20261110_234500_no_deduction_buyback';
import * as migration_20261111_003500_buyback_sort from './20261111_003500_buyback_sort';
import * as migration_20261112_000000_announcement_published_at from './20261112_000000_announcement_published_at';
import * as migration_20261114_000000_card_status_color from './20261114_000000_card_status_color';

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
  {
    up: migration_20261105_020000_roles_permission_model.up,
    down: migration_20261105_020000_roles_permission_model.down,
    name: '20261105_020000_roles_permission_model',
  },
  {
    up: migration_20261105_030000_fix_roles_permissions_cols.up,
    down: migration_20261105_030000_fix_roles_permissions_cols.down,
    name: '20261105_030000_fix_roles_permissions_cols',
  },
  {
    up: migration_20261105_040000_fix_roles_permissions_id.up,
    down: migration_20261105_040000_fix_roles_permissions_id.down,
    name: '20261105_040000_fix_roles_permissions_id',
  },
  {
    up: migration_20261106_050000_add_roles_id_to_locked_docs_rels.up,
    down: migration_20261106_050000_add_roles_id_to_locked_docs_rels.down,
    name: '20261106_050000_add_roles_id_to_locked_docs_rels',
  },
  {
    up: migration_20261110_221000_card_statuses.up,
    down: migration_20261110_221000_card_statuses.down,
    name: '20261110_221000_card_statuses',
  },
  {
    up: migration_20261110_234500_no_deduction_buyback.up,
    down: migration_20261110_234500_no_deduction_buyback.down,
    name: '20261110_234500_no_deduction_buyback',
  },
  {
    up: migration_20261111_003500_buyback_sort.up,
    down: migration_20261111_003500_buyback_sort.down,
    name: '20261111_003500_buyback_sort',
  },
  {
    up: migration_20261112_000000_announcement_published_at.up,
    down: migration_20261112_000000_announcement_published_at.down,
    name: '20261112_000000_announcement_published_at',
  },
  {
    up: migration_20261114_000000_card_status_color.up,
    down: migration_20261114_000000_card_status_color.down,
    name: '20261114_000000_card_status_color',
  },
];
