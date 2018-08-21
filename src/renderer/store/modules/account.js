import { Mutations, Actions, Getters } from '@/constants/types.constants';
import { 
  getAccountInfo, 
  transfer, 
  getAvailable, 
  getTransferRecord, 
  vote, 
  unfreeze, 
  claim, 
  getTokenList, 
  transfer_account,
  getAccount,
  getRewardsAndBpsTable,
  count_asset_total
} from '@/services/Eos';

const initState = {
  accountName: '',
  info: {
    assetTotal: 0,
    available: 0,
    stakedTotal: 0,
    unstakingTotal: 0,
    rewardTotal: 0,
    baseInfo: {}
  },
  bpsTable: [],
  transferRecords: {
    offset: 20,
    pos: 0,
    list: [],
    more: true
  },
  tokenList: [],
  on_load_info: false,
  pre_load_key: '',
  on_load_bps_table: false,
  pre_load_bps_key: '',
  load_key: 0
};

const mutations = {
  [Mutations.SET_ACCOUNT_NAME](state, { accountName = '' } = {}) {
    state.accountName = accountName;
  },
  [Mutations.RESET_ACCOUNT_INFO](state) {
    state.transferRecords.list.splice(0, state.transferRecords.list.length);
    state.transferRecords.pos = 0;
    state.transferRecords.more = true;
  },
  [Mutations.SET_ACCOUNT_INFO](state, { info = {} } = {}) {
    state.info = info;
  },
  [Mutations.SET_BPS_TABLE](state, { bpsTable = [] } = {}) {
    state.bpsTable = bpsTable;
  },
  [Mutations.SET_TRANSFER_RECORDS](state, { transferRecords = {} } = {}) {
    if (transferRecords.list.length < state.transferRecords.offset) {
      state.transferRecords.more = false;
    }
    state.transferRecords.list.splice(state.transferRecords.list.length, 0, ...transferRecords.list);
    state.transferRecords = transferRecords;
  },
  [Mutations.SET_TOKEN_LIST](state, { tokenList = [] } = {}) {
    state.tokenList = tokenList;
  },
  [Mutations.START_LOAD_ACCOUNT_INFO](state, { accountName }){
    if (accountName == state.pre_load_key) return;
    state.on_load_info = true;
    state.pre_load_key = accountName;
  },
  [Mutations.FINISH_LOAD_ACCOUNT_INFO](state){
    state.on_load_info = false;
  },
  update_available (state, available) {
    state.info.available = available;
  },
  update_base_info (state, baseInfo) {
    state.info.baseInfo = baseInfo;
  },
  start_on_load_bps_table (state, accountName) {
    if (accountName == state.pre_load_bps_key) return;
    state.on_load_bps_table = true;
    state.pre_load_bps_key = accountName;
  },
  finish_on_load_bps_table (state, accountName) {
    state.on_load_bps_table = false;
  },
  set_staked_total (state, stake_total) {
    state.info.stakedTotal = stake_total;
  },
  set_unstaking_total (state, unstaking_total) {
    state.info.unstakingTotal = unstaking_total;
  },
  set_reward_total (state, reward_total) {
    state.info.rewardTotal = reward_total;
  },
  set_asset_total (state, asset_total) {
    state.info.assetTotal = asset_total;
  },
  clear_info (state) {
    state.info.stakedTotal = 0;
    state.info.unstakingTotal = 0;
    state.info.rewardTotal = 0;
    state.info.assetTotal = 0;
    state.info.baseInfo = {};
  },
  set_load_key (state, load_key){
    state.load_key = load_key;
  }
};

const actions = {
  [Actions.REFRESH_APP]({ state, commit, dispatch }) {
    dispatch(Actions.FETCH_ACCOUNT, { accountName: state.accountName });
  },
  [Actions.FETCH_ACCOUNT]({ commit, dispatch }, { accountName }) {
    commit(Mutations.RESET_ACCOUNT_INFO);
    commit(Mutations.SET_ACCOUNT_NAME, { accountName });
    dispatch(Actions.GET_ACCOUNT_INFO);
  },
  [Actions.TRANSFER]({ state, dispatch, getters }, { from, to, amount, memo, password, tokenSymbol, precision, walletId, permission }) {
    return getters[Getters.GET_TRANSE_CONFIG](password, from, walletId).then(config => {
      return transfer(config)({ from, to, amount, memo, tokenSymbol, precision, permission });
    });
  },
  [Actions.VOTE]({ state, dispatch, getters }, { voter, bpname, amount, password, walletId, permission }) {
    return getters[Getters.GET_TRANSE_CONFIG](password, voter, walletId).then(config => {
      return vote(config)({ voter, bpname, amount, permission });
    });
  },
  [Actions.UNFREEZE]({ state, dispatch, getters }, { voter, bpname, password, walletId, permission }) {
    return getters[Getters.GET_TRANSE_CONFIG](password, voter, walletId).then(config => {
      return unfreeze(config)({ voter, bpname, permission });
    });
  },
  [Actions.CLAIM]({ state, dispatch, getters }, { voter, bpname, password, walletId, permission }) {
    return getters[Getters.GET_TRANSE_CONFIG](password, voter, walletId).then(config => {
      return claim(config)({ voter, bpname, permission });
    });
  },
  check_total_and_set_asset_total({state, dispatch, commit, getters}) {
    let is_loaded_all = true;
    let except_key = ['assetTotal', 'baseInfo'];
    for(let item in state.info){
      if (!state.info[item] && except_key.indexOf(item) < 0) {
        is_loaded_all = false;
      }
    }
    if(is_loaded_all){
      let asset_total = count_asset_total(
        state.info.available,
        state.info.stakedTotal,
        state.info.unstakingTotal,
        state.info.rewardTotal
      )
      commit('set_asset_total', asset_total);
      commit(Mutations.FINISH_LOAD_ACCOUNT_INFO);
    }
    return is_loaded_all;
  },
  start_load_new_account({state, dispatch, commit, getters}) {
    const accountName = getters[Getters.CURRENT_ACCOUNT_NAME];
    let new_load_key = new Date().getTime();
    if(accountName != state.pre_load_key){
      commit('clear_info');
    }
    commit('start_on_load_bps_table', accountName);
    commit(Mutations.START_LOAD_ACCOUNT_INFO, { accountName });
    commit('set_load_key', new_load_key);
    return new_load_key;
  },
  async [Actions.GET_ACCOUNT_INFO]({ state, dispatch, commit, getters }) {
    const accountName = getters[Getters.CURRENT_ACCOUNT_NAME];
    let node_url = getters[Getters.CURRENT_NODE];
    // let new_key = await dispatch('start_load_new_account');
    dispatch('start_load_new_account');
    // let start_time = new Date().getTime();
    let {bpsTable, stakedTotal, unstakingTotal, rewardTotal} = await getRewardsAndBpsTable(node_url)(accountName)
    if (accountName != state.pre_load_key) {
      return;
    }
    commit(Mutations.SET_BPS_TABLE, { bpsTable });
    commit('finish_on_load_bps_table');
    commit('set_staked_total', stakedTotal);
    commit('set_unstaking_total', unstakingTotal);
    commit('set_reward_total', rewardTotal);

    dispatch('check_total_and_set_asset_total');
    getAvailable(node_url)(accountName)
      .then(available => {
        commit('update_available', available);
        dispatch('check_total_and_set_asset_total');
      });
    getAccount(node_url)(accountName)
      .then(baseInfo => {
        commit('update_base_info', baseInfo);
        dispatch('check_total_and_set_asset_total');
      });
    dispatch(Actions.GET_TOKEN_LIST, { accountName });
    dispatch(Actions.GET_TRANSFER_RECORD, { accountName });
  },
  [Actions.GET_TRANSFER_RECORD]({ state, commit, getters }, { accountName, pos, offset }) {
    pos = pos === undefined ? state.transferRecords.pos : pos;
    offset = offset || state.transferRecords.offset;
    return getTransferRecord(getters[Getters.CURRENT_NODE])({ accountName, pos, offset }).then(result => {
      commit(Mutations.SET_TRANSFER_RECORDS, { transferRecords: { list: result.actions, pos, offset } });
    });
  },
  [Actions.GET_TOKEN_LIST]({ dispatch, commit, getters }, { accountName }) {
    return getTokenList(getters[Getters.CURRENT_NODE])(accountName).then(result => {
      commit(Mutations.SET_TOKEN_LIST, { tokenList: result });
    });
  },
  [Actions.GET_BPS_TABLE]({ state, dispatch, commit, getters }) {
    const accountName = getters[Getters.CURRENT_ACCOUNT_NAME];
    return getAccountInfo(getters[Getters.CURRENT_NODE])(accountName).then(({ bpsTable }) => {
      commit(Mutations.SET_BPS_TABLE, { bpsTable });
    });
  },

  [Actions.GET_ACCOUNT_OVERVIEW]({ state, dispatch, commit, getters }) {
    const accountName = getters[Getters.CURRENT_ACCOUNT_NAME];
    return getAccountInfo(getters[Getters.CURRENT_NODE])(accountName).then(({ info }) => {
      commit(Mutations.SET_ACCOUNT_INFO, { info });
    });
  },

  async [Actions.TRANSFER_ACCOUNT]({ state, dispatch, commit, getters }, { name, publick_key, password, walletId, permissions = ['active', 'owner'] }) {
    let with_out_reject = true;
    let config = await getters[Getters.GET_TRANSE_CONFIG](password, name, walletId, with_out_reject);
    if (config.is_error){
      return config;
    }
    let res = await transfer_account(config)({ name, publick_key, permissions });
    return res;
  },
};

const getters = {
  [Getters.CURRENT_ACCOUNT_NAME](state, getters, rootState) {
    return state.accountName;
  },
};

export default {
  state: initState,
  mutations,
  actions,
  getters,
};
