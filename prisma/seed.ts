import 'dotenv/config';
import {randomBytes} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {db} from '../src/lib/db';
import {hashPassword} from '../src/lib/security/password';
import {today,weekDay} from '../src/lib/time';
if(process.env.NODE_ENV==='production')throw new Error('Üretimde seed çalıştırılamaz.');
if(await db.user.count())throw new Error('Seed yalnızca boş geliştirme veritabanında çalışır.');
const password=randomBytes(18).toString('base64url')+'aA1!',passwordHash=await hashPassword(password);
await db.$transaction(async tx=>{
 const institution=await tx.institutionSettings.create({data:{id:'main',name:'Akademi Eğitim Kurumları',email:'iletisim@example.test',academicYear:'2026–2027'}});
 const create=(firstName:string,lastName:string,email:string,role:'STUDENT'|'TEACHER'|'ADMIN')=>tx.user.create({data:{firstName,lastName,email,passwordHash,role,emailVerified:new Date(),...(role==='STUDENT'?{student:{create:{}}}:role==='TEACHER'?{teacher:{create:{}}}:{})},include:{student:true,teacher:true}});
 const admin=await create('Deniz','Yönetici','yonetici@example.test','ADMIN');
 const teachers=await Promise.all([create('Selin','Örnek','ogretmen1@example.test','TEACHER'),create('Mert','Örnek','ogretmen2@example.test','TEACHER')]);
 const names=['Ada','Ege','Defne','Aras','İpek'];const students=[];for(let i=0;i<5;i++)students.push(await create(names[i],'Örnek',`ogrenci${i+1}@example.test`,'STUDENT'));
 // Synthetic accounts intentionally have no TCKN fields. They sign in by email only.
 const classes=await Promise.all(['12-A Sayısal','12-B Sayısal'].map(name=>tx.class.create({data:{name,description:'Geliştirme ortamına ait örnek sınıf.'}})));
 const subjectNames=['Türkçe','Sosyal Bilimler','Temel Matematik','Fen Bilimleri','Matematik','Fizik','Kimya','Biyoloji','Türk Dili ve Edebiyatı','Tarih','Coğrafya','Felsefe'];
 const subjects=[];for(const name of subjectNames)subjects.push(await tx.subject.create({data:{name}}));
 const rooms=await Promise.all(['Derslik 101','Derslik 102'].map(name=>tx.classroom.create({data:{name}})));
 for(let i=0;i<students.length;i++)await tx.classEnrollment.create({data:{studentId:students[i].student!.id,classId:classes[i<3?0:1].id}});
 for(const c of classes)for(let i=0;i<2;i++)await tx.teacherClassAssignment.create({data:{classId:c.id,teacherId:teachers[i].teacher!.id,subjectId:subjects[i===0?2:0].id}});
 const day=weekDay(today());for(let i=0;i<2;i++)await tx.lessonSchedule.create({data:{classId:classes[0].id,teacherId:teachers[i].teacher!.id,subjectId:subjects[i===0?2:0].id,classroomId:rooms[0].id,day,startMinute:540+i*60,endMinute:580+i*60}});
 await tx.lessonSchedule.create({data:{classId:classes[1].id,teacherId:teachers[0].teacher!.id,subjectId:subjects[2].id,classroomId:rooms[1].id,day:(day+1)%7,startMinute:660,endMinute:700}});
 const tyt=await tx.examTemplate.create({data:{name:'TYT Standart',type:'TYT',subjects:{create:subjects.slice(0,4).map((s,i)=>({subjectId:s.id,questionCount:[40,20,40,20][i]}))}},include:{subjects:true}});
 await tx.examTemplate.create({data:{name:'AYT Sayısal',type:'AYT',subjects:{create:subjects.slice(4,8).map((s,i)=>({subjectId:s.id,questionCount:[40,14,13,13][i]}))}}});
 for(let i=0;i<2;i++){const date=new Date(today());date.setUTCDate(date.getUTCDate()-(2-i)*7);const exam=await tx.exam.create({data:{name:`TYT Gelişim Denemesi ${i+1}`,templateId:tyt.id,date,status:'PUBLISHED',description:'Açıkça örnek geliştirme verisidir.',classes:{create:classes.map(c=>({classId:c.id}))}}});const values=tyt.subjects.map(s=>({templateSubjectId:s.id,correct:Math.floor(s.questionCount*.5)+i*2,wrong:4,blank:s.questionCount-Math.floor(s.questionCount*.5)-i*2-4}));for(const student of students){const result=await tx.examResult.create({data:{examId:exam.id,studentId:student.student!.id,totalNet:values.reduce((a,v)=>a+v.correct-v.wrong/4,0)}});await tx.examSubjectResult.createMany({data:values.map(v=>({...v,resultId:result.id,net:v.correct-v.wrong/4}))});}}
 await tx.assignment.create({data:{title:'Problemler · Karma testler',description:'Konu kitabındaki 4. ve 5. testleri çözün. Sorularınızı bir sonraki derse getirin.',classId:classes[0].id,subjectId:subjects[2].id,creatorId:teachers[0].id,dueAt:new Date(Date.now()+3*86400000)}});
 await tx.assignment.create({data:{title:'Paragraf çalışması',description:'20 paragraf sorusu çözün, yanlışlarınızı inceleyin.',classId:classes[0].id,subjectId:subjects[0].id,creatorId:teachers[1].id,dueAt:new Date(Date.now()+2*86400000)}});
 await tx.announcement.create({data:{title:'Akademi’ye hoş geldiniz',content:'Bu kayıtlar yalnızca geliştirme ortamını denemek için oluşturulmuştur. Ders programınızı, ödevlerinizi ve deneme sonuçlarınızı ilgili menülerden inceleyebilirsiniz.',audience:'ALL',creatorId:admin.id}});
 await tx.auditLog.create({data:{actorId:admin.id,action:'DEVELOPMENT_SEED',entityId:institution.id}});
});
mkdirSync('work',{recursive:true});writeFileSync('work/development-accounts.md',`# Yalnızca bu yerel geliştirme ortamı\n\nHer seed çalıştırmada rastgele üretilen parola: ${password}\n\nYönetici: yonetici@example.test\nÖğretmenler: ogretmen1@example.test, ogretmen2@example.test\nÖğrenciler: ogrenci1@example.test – ogrenci5@example.test\n\nGerçek kimlik verisi kullanılmaz. TC ile giriş bu örnek hesaplarda kapalıdır.\n`,{mode:0o600});
console.log('Geliştirme verileri eklendi. Rastgele giriş bilgileri yalnızca work/development-accounts.md dosyasına yazıldı.');await db.$disconnect();
