window.PhotoScoutStorage={
  key:'photoScout.locations.v1',
  get(){try{return JSON.parse(localStorage.getItem(this.key)||'[]')}catch{return[]}},
  set(items){localStorage.setItem(this.key,JSON.stringify(items))},
  add(item){const items=this.get();items.unshift(item);this.set(items);return items},
  remove(id){const items=this.get().filter(item=>item.id!==id);this.set(items);return items}
};
