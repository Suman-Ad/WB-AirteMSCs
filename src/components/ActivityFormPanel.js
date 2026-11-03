import React from 'react';

const flatten = children => React.Children.toArray(children).flatMap(child=>child.type === React.Fragment ? flatten(child.props.children) : [child]);
export function ActivityFormPanel({children}) {
  const items=flatten(children), fields=[];
  for(let i=0;i<items.length;i++) {
    const item=items[i],next=items[i+1];
    if(item.type === 'label' && ['input','select','textarea'].includes(next?.type)) {
      const id=next.props.id || `activity-field-${i}`;
      fields.push(<div className="activity-form-field" key={id}>{React.cloneElement(item,{htmlFor:id})}{React.cloneElement(next,{id})}</div>);i++;
    } else fields.push(<div className="activity-form-block" key={i}>{item}</div>);
  }
  return <section className="activity-panel activity-form-panel">{fields}</section>;
}
