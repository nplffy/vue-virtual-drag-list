import SortableDnd from 'sortable-dnd';
import { Store } from './Storage';

const attributes = [
  'group',
  'handle',
  'disabled',
  'draggable',
  'ghostClass',
  'ghostStyle',
  'chosenClass',
  'animation',
  'autoScroll',
  'scrollThreshold',
];

let dragEl = null;

function Sortable(context, callback) {
  this.context = context;
  this.callback = callback;

  this.initialList = [...context.list];
  this.dynamicList = [...context.list];

  this.sortable = null;
  this.rangeChanged = false;

  this._init();
}

Sortable.prototype = {
  constructor: Sortable,

  destroy() {
    this.sortable && this.sortable.destroy();
    this.sortable = null;
  },

  setValue(key, value) {
    if (key === 'list') {
      this.initialList = [...value];
      // When the list data changes when dragging, need to execute onDrag function
      if (dragEl) this._onDrag(dragEl, false);
    } else {
      this.context[key] = value;
      this.sortable.options[key] = value;
    }
  },

  _init() {
    const props = attributes.reduce((res, key) => {
      res[key] = this.context[key];
      return res;
    }, {});

    this.sortable = new SortableDnd(this.context.$refs.group, {
      ...props,
      initialList: [...this.initialList],
      onDrag: ({ from }) => this._onDrag(from.node),
      onAdd: ({ from, to }) => this._onAdd(from, to),
      onRemove: ({ from, to }) => this._onRemove(from, to),
      onChange: ({ from, to }) => this._onChange(from, to),
      onDrop: ({ from, to, changed }) => this._onDrop(from, to, changed),
    });
  },

  async _onDrag(node, callback = true) {
    dragEl = node;
    this.dynamicList = [...this.initialList];

    const fromList = [...this.initialList];
    const fromState = this._getFromTo({ node }, fromList);

    await Store.setValue({ from: { list: fromList, ...fromState } });

    if (callback) {
      this.rangeChanged = false;
      const store = await Store.getValue();
      this.context.$emit('drag', { list: fromList, ...store });
    } else {
      this.rangeChanged = true;
    }
  },

  async _onAdd(from, to) {
    const state = await Store.getValue();
    const fromList = [...state.from.list];
    const toList = [...this.dynamicList];
    const fromState = this._getFromTo(from, fromList);
    const toState = this._getFromTo(to, toList);

    await Store.setValue({
      from: { list: fromList, ...fromState },
      to: { list: toList, ...toState },
    });

    this.dynamicList.splice(toState.index, 0, fromState.item);

    const store = await Store.getValue();
    this.context.$emit('add', { list: this.dynamicList, ...store });
  },

  async _onRemove(from, to) {
    const fromList = [...this.initialList];
    const toList = [...to.sortable.options.initialList];
    const fromState = this._getFromTo(from, fromList);
    const toState = this._getFromTo(to, toList);

    await Store.setValue({
      from: { list: fromList, ...fromState },
      to: { list: toList, ...toState },
    });

    this.dynamicList.splice(fromState.index, 1);

    const store = await Store.getValue();
    this.context.$emit('remove', { list: this.dynamicList, ...store });
  },

  async _onChange(from, to) {
    const fromList = [...this.dynamicList];
    const toList = [...this.dynamicList];
    const fromState = this._getFromTo(from, fromList);
    const toState = this._getFromTo(to, toList);

    await Store.setValue({ to: { list: toList, ...toState } });

    this.dynamicList.splice(fromState.index, 1);
    this.dynamicList.splice(toState.index, 0, fromState.item);
  },

  async _onDrop(from, to, changed) {
    if (this.rangeChanged || from.sortable !== to.sortable) {
      dragEl && dragEl.remove();
    }

    const toList = [...this.dynamicList];
    const index = this._getIndex(toList, from.node.dataset.key);
    const item = this.initialList[index];
    const key = this.context._getDataKey(item);

    await Store.setValue({
      to: { list: [...this.initialList], index, item, key },
    });

    const store = await Store.getValue();
    const params = { list: [...toList], ...store, changed };

    this.context.$emit('drop', params);
    this.callback && this.callback(params);

    this.initialList = [...toList];
    this._clear();
  },

  _getFromTo(fromTo, list) {
    const key = fromTo.node.dataset.key;
    const index = this._getIndex(list, key);
    const item = list[index];

    return { key, item, index };
  },

  _getIndex(list, key) {
    return list.findIndex((item) => this.context._getDataKey(item) == key);
  },

  _clear() {
    dragEl = null;
    Store.clear();
    this.rangeChanged = false;
  },
};

export default Sortable;
