import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import type { AnyNode } from "domhandler";
import { catalogUrl, defaults, groups, isPriceService, plansFor, priceText, services, videoSource,
  type CatalogItem, type Plan, type SiteContent } from "../lib/site-data";
import { readContent } from "./db";

const cache = new Map<string,string>();
async function template(key:string) {
  if (!cache.has(key)) cache.set(key, await readFile(process.cwd()+"/source/"+key+".html","utf8"));
  return load(cache.get(key)!);
}
type Document = Awaited<ReturnType<typeof template>>;

function applyCopy($:Document, page:SiteContent["pageContent"][string]) {
  const value = (path:string) => {const [part,key]=path.split("/"); return page?.[part]?.[key];};
  function read(nodes:AnyNode[]) {
    for(const node of nodes) {
      if(node.type==="comment" && node.data.startsWith("hung-copy:") && node.next?.type==="text") {
        const text=value(node.data.slice(10));
        if(text!==undefined && node.next.data.replace(/\s+/g," ").trim()!==text) {
          node.next.data=(node.next.data.match(/^\s*/)?.[0] ?? "")+text+(node.next.data.match(/\s*$/)?.[0] ?? "");
        }
      }
      if("children" in node)read(node.children);
    }
  }
  read($("body").contents().get());
  for(const attr of ["alt","placeholder"]) {
    $("[data-hung-"+attr+"]").each((_,el)=>{
      const element=$(el), text=value(element.attr("data-hung-"+attr)!);
      if(text!==undefined)element.attr(attr,text);
    });
  }
}

function applyContact($:Document, info:SiteContent["contact"]) {
  const tel=info.hotline.replace(/[^\d+]/g,"");
  const text=(value:string) => value
    .replace(/2047 Nguyễn Ái Quốc, Phường Trấn Biên, Thành Phố Đồng Nai/gi,()=>info.address)
    .replace(/0985[ .]?535[ .]?633/g,()=>info.hotline)
    .replace(/Lê Ngọc Hùng/g,()=>info.name)
    .replace(/Tư vấn giải pháp số/g,()=>info.role)
    .replace(/\bAnh Hùng/g,()=>"Chuyên viên "+info.name)
    .replace(/\banh Hùng/g,()=>"chuyên viên "+info.name)
    .replace(/Liên hệ Hùng/g,()=>"Liên hệ "+info.name);
  function walk(nodes:AnyNode[]) {
    for(const node of nodes) {
      if(node.type==="text") node.data=text(node.data);
      else if(node.type!=="style" && node.type!=="script" && "children" in node)walk(node.children);
    }
  }
  walk($("body").contents().get());
  if(info.name===defaults.contact.name) {
    // Keep the approved wording when the contact still matches the original.
    function keepOriginal(nodes:AnyNode[]) {
      for(const node of nodes) {
        if(node.type==="text")node.data=node.data.replaceAll("Chuyên viên Lê Ngọc Hùng","Anh Hùng").replaceAll("chuyên viên Lê Ngọc Hùng","anh Hùng").replaceAll("Liên hệ Lê Ngọc Hùng","Liên hệ Hùng");
        else if(node.type!=="style" && node.type!=="script" && "children" in node)keepOriginal(node.children);
      }
    }
    keepOriginal($("body").contents().get());
  }
  $("img[alt]").each((_,element)=>{$(element).attr("alt",text($(element).attr("alt")!));});
  $("a[href^='tel:']").attr("href","tel:"+tel);
  $(".intro .portrait img").attr("src",info.portrait);
  const ticker=$(".address-ticker");
  if(ticker.length) {
    if(info.address!==defaults.contact.address||info.hotline!==defaults.contact.hotline) ticker.text(info.address+" · Điện thoại: "+info.hotline);
    if(info.ticker) ticker.append($("<span>").text(" · "+info.ticker));
  }
}
function absolutePaths($:Document) {
  $("[src^='assets/']").each((_,el)=>{$(el).attr("src","/"+$(el).attr("src"));});
  $("a[href='index.html'],a[href^='index.html#'],a[href^='index.html?']").each((_,el)=>{
    $(el).attr("href",$(el).attr("href")!.replace(/^index\.html/,"/"));
  });
}
function consult(id:string,plan?:string) {
  return "/?san-pham="+encodeURIComponent(id)+(plan?"&goi="+encodeURIComponent(plan):"")+"#register";
}
function fillLines($:Document, lines:string[], target:ReturnType<Document>) {
  target.empty();
  lines.filter(Boolean).forEach(line=>target.append($("<li>").text(line)));
}

function mp4Images(data:SiteContent, service:string) {
  if(isPriceService(service))return data.media.products[service];
  return data.serviceCatalog.find(item=>item.id===service)?.image??"";
}

function homepage($:Document, data:SiteContent) {
  const catalog=data.serviceCatalog.filter(item=>item.enabled);
  const visible=new Set(catalog.map(item=>item.id));
  if(catalog.length!==6) {
    const hint=$(".intro .hint").first(), label=hint.text();
    hint.text(label.replace("06 nhóm giải pháp", catalog.length+" nhóm giải pháp"));
  }
  const cards=$(".cards .card").toArray().map(el=>$(el).clone());
  const savedSlide=$("#slides .slide").first().clone();
  const slideList=$("#slides").empty();
  const gallery=data.gallery.filter(item=>item.enabled&&(!item.service||visible.has(item.service)));
  if(!data.visibility.gallery||!gallery.length) { $("#guide,a[href='#guide']").remove(); }
  else {
    gallery.forEach((item,index)=>{
      const slide=savedSlide.clone().toggleClass("active",index===0).attr("aria-hidden",String(index!==0));
      const image=item.image||mp4Images(data,item.service);
      if(image) slide.find("img").attr({src:image,alt:"Ảnh minh họa "+item.title});
      else slide.find("img").remove();
      slide.find("h2").text(item.title);slide.find("h3").text(item.subtitle);slide.find("p").text(item.description);
      fillLines($,item.details,slide.find("ul"));
      slideList.append(slide);
    });
    $("#slideCount").text("1 / "+gallery.length);
    if(gallery.length<2) $("#prev,#next,#pause").prop("hidden",true);
  }
  const container=$(".cards").empty(), checks=$(".checks").empty();
  catalog.forEach(item=>{
    const oldIndex=services.indexOf(item.id as (typeof services)[number]);
    const card=(cards[oldIndex]??cards[0]).clone();
    const path=catalogUrl(item), image=mp4Images(data,item.id);
    const thumbnail=card.find("img").parent("a").attr("href",path);
    if(image) thumbnail.find("img").attr({src:image,alt:"Ảnh minh họa "+item.name});
    else thumbnail.remove();
    card.find("h3").text(item.name);card.find(".eyebrow").text(item.category);card.find(".cardbody > p").text(item.description);
    fillLines($,item.points,card.find(".cardbody ul"));
    card.find("[data-detail]").attr("data-detail",item.id);
    card.find("[data-consult-product]").attr("data-consult-product",item.id);
    container.append(card);
    checks.append($("<label class='check'>").append($("<input type='checkbox' name='products'>").val(item.id)).append($("<span>").text(" "+item.name)));
  });
  if(!catalog.length)$(".cards").append($("<p>").text("Vui lòng liên hệ để được tư vấn."));
  const faqs=$(".faq details"), faqParent=faqs.first().parent();
  if(!data.visibility.faq||!data.faq.some(item=>item.enabled)) $(".faq").remove();
  else {
    faqs.remove();
    data.faq.filter(item=>item.enabled).forEach(item=>{
      faqParent.append($("<details>").append($("<summary>").text(item.q),$("<p>").text(item.a)));
    });
  }
  data.blocks.filter(item=>item.enabled).forEach(item=>{
    const block=$("<section class='wrap hung-block'>").append($("<h2>").text(item.title),$("<p>").text(item.description));
    if(item.image)block.append($("<img loading='lazy'>").attr({src:item.image,alt:item.title}));
    $("#register").before(block);
  });
  const videos=data.videos.filter(item=>item.enabled&&(!item.service||visible.has(item.service))).flatMap(item=>{
    const source=videoSource(item.link);
    if(!source)return [];
    return [{title:item.title,service:item.service,category:catalog.find(service=>service.id===item.service)?.category,
      poster:mp4Images(data,item.service),...source}];
  });
  if(!data.visibility.videos||!videos.length) $("#resources,a[href='#resources']").remove();
  else $("#videoNote").after($("<button type='button' class='btn' id='videoConsult'>").text("Tư vấn giải pháp này"));
  $("template").remove();
  $("#form").attr({method:"post",action:"/api/consult"}).append($("<div id='quoteChoices' aria-live='polite'>"));
  const config={catalog:catalog.map(item=>({
    id:item.id,name:item.name,path:catalogUrl(item),category:item.category,description:item.description,points:item.points,
    plans:plansFor(data,item.id).filter(plan=>plan.enabled),
    groups:isPriceService(item.id)?groups[item.id]:{}
  })),videos};
  $("body").append($("<script type='application/json' id='hung-site-data'>").text(JSON.stringify(config).replace(/</g,"\\u003c")),
    $("<script src='/hung-site.js' defer>"),
    $("<style>").text(".hung-block{padding:2rem 0}.hung-block img{max-width:100%;height:auto}.hung-block p{white-space:pre-line}.plan-card .hung-choose{margin-top:.5rem}.checks .check{align-items:center}.hung-quote{margin-top:.45rem}.hung-quote button{margin-left:.5rem}.slide[hidden],.plan-card[hidden],#videoConsult[hidden]{display:none}"));
}

function renderPlans($:Document,item:CatalogItem,plans:Plan[]) {
  $(".pricing").append($("<style>").text(".pricing th a{color:inherit}"));
  $("table[data-plan-table]").each((_,node)=>{
    const table=$(node), tbody=table.find("tbody").empty();
    const index=Number(table.attr("data-plan-table"));
    const columns=table.find("thead tr").first().children().length;
    const enabled=plans.filter(plan=>plan.enabled&&("tableIndex" in plan?plan.tableIndex:0)===index);
    if(!enabled.length) {
      if(table.prev().is("h3,h4"))table.prev().remove();
      table.remove();
      return;
    }
    for(const plan of enabled){
      const row=$("<tr>");
      row.append($("<th scope='row'>").append($("<a>").attr("href",consult(item.id,plan.id)).text(plan.tableName||plan.name)));
      if(columns===3) {
        const description=$("<td>");
        (plan.tableDetail || plan.details.join("\n")).split("\n").forEach((line,i)=>{
          if(i)description.append("<br>");
          description.append($("<span>").text(line));
        });
        row.append(description);
      }
      row.append($("<td>").text(priceText(plan.price)));
      tbody.append(row);
    }
  });
}
export async function renderSite(key:string, slug?:string) {
  let data=defaults;
  try { ({data}=await readContent()); }
  catch(error) {
    // The landing pages remain available during database setup or an outage.
    console.error("Hùng public content", (error as {code?:string})?.code ?? "unavailable");
  }
  const custom=typeof slug==="string";
  const id=key.startsWith("san-pham-")?key.slice(9):"";
  const item=data.serviceCatalog.find(service=>service.enabled&&(custom?!isPriceService(service.id)&&service.slug===slug:service.id===id));
  if((id||custom)&&!item) {
    return new Response("Dịch vụ không còn hiển thị.",{status:404,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  }
  const $=await template(custom?"san-pham-ftth":key);
  if(!custom)applyCopy($,data.pageContent[key]);
  if(item) {
    if(custom) {
      $("title,.layout h1").text(item.detailTitle||item.name);
      $("meta[name='description']").attr("content",item.detailIntro||item.description);
      $(".layout .eyebrow").text(item.category);
      $(".layout .body > p").first().text(item.detailIntro||item.description);
      if(item.detailContent) $(".layout .body > p").first().after($("<p style='white-space:pre-line'>").text(item.detailContent));
      fillLines($,item.points,$(".layout ul"));
      $(".pricing > p").remove();
      $(".pricing th").eq(1).text("Chi tiết");
      $("a[href*='?san-pham=']").attr("href",consult(item.id));
      if(item.official) $(".layout .actions").append($("<a class='button secondary' target='_blank' rel='noopener'>").attr("href",item.official).text("Website Viettel"));
    }else {
      const link=$("footer a[href^='https://']").first();
      if(link.length) {
        if(item.official)link.attr("href",item.official);
        else link.remove();
      }else if(item.official) {
        $(".layout .actions").append($("<a class='button secondary' target='_blank' rel='noopener'>")
          .attr("href",item.official).text("Website Viettel"));
      }
    }
    const image=mp4Images(data,item.id);
    if(image) $(".layout img").first().attr("src",image);
    else $(".layout img").first().remove();
    renderPlans($,item,plansFor(data,item.id));
  }else homepage($,data);
  applyContact($,data.contact);
  absolutePaths($);
  return new Response($.html(),{headers:{
    "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff",
    "Referrer-Policy":"strict-origin-when-cross-origin", "X-Frame-Options":"SAMEORIGIN"
  }});
}
