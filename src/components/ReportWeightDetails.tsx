import {Fragment} from 'react';
import {reportWeightLabel,type ReportGroup} from '../core/report';
export default function ReportWeightDetails({group}:{group:ReportGroup}){
 const nonzero=group.materials.filter(m=>m.kg!=='0'),zeros=group.materials.filter(m=>m.kg==='0');
 const details=(items:ReportGroup['materials'])=><dl className="report-weight-pairs">{items.map(m=><Fragment key={m.name}><dt>{reportWeightLabel(m.name,group.business)}</dt><dd>{m.kg??'未提供'}</dd></Fragment>)}</dl>;
 return <div className="report-weight-details">
 {nonzero.length?details(nonzero):zeros.length===1?details(zeros):zeros.length?<span className="weight-zero-note">已填项均为 0</span>:<span>未提供</span>}
 {zeros.length>0&&(nonzero.length>0||zeros.length>1)&&<details className="zero-materials"><summary>查看零值明细（{zeros.length} 项）</summary>{details(zeros)}</details>}
 </div>;
}
