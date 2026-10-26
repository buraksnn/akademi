BEGIN;
-- Invariants must also hold when data is written outside the application.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER SEQUENCE "StudentProfile_number_seq" RESTART WITH 1001;
CREATE UNIQUE INDEX "ClassEnrollment_one_active_class" ON "ClassEnrollment"("studentId") WHERE active;
ALTER TABLE "LessonSchedule" ADD CONSTRAINT schedule_valid_times CHECK (day BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute");
ALTER TABLE "LessonSchedule" ADD CONSTRAINT teacher_no_overlap EXCLUDE USING gist ("teacherId" WITH =, day WITH =, int4range("startMinute","endMinute",'[)') WITH &&) WHERE (active);
ALTER TABLE "LessonSchedule" ADD CONSTRAINT classroom_no_overlap EXCLUDE USING gist ("classroomId" WITH =, day WITH =, int4range("startMinute","endMinute",'[)') WITH &&) WHERE (active);
ALTER TABLE "LessonSchedule" ADD CONSTRAINT class_no_overlap EXCLUDE USING gist ("classId" WITH =, day WITH =, int4range("startMinute","endMinute",'[)') WITH &&) WHERE (active);
ALTER TABLE "ExamTemplateSubject" ADD CONSTRAINT positive_question_count CHECK ("questionCount" BETWEEN 1 AND 200);
ALTER TABLE "ExamSubjectResult" ADD CONSTRAINT nonnegative_answers CHECK (correct >= 0 AND wrong >= 0 AND blank >= 0 AND net = correct - wrong::numeric/4);
ALTER TABLE "Exam" ADD CONSTRAINT exam_status CHECK (status IN ('DRAFT','PUBLISHED'));
CREATE FUNCTION validate_exam_subject_result() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE max_questions integer; template_id text; result_template_id text;
BEGIN
  SELECT "questionCount","templateId" INTO max_questions,template_id FROM "ExamTemplateSubject" WHERE id=NEW."templateSubjectId";
  SELECT e."templateId" INTO result_template_id FROM "ExamResult" r JOIN "Exam" e ON e.id=r."examId" WHERE r.id=NEW."resultId";
  IF NEW.correct+NEW.wrong+NEW.blank > max_questions OR template_id<>result_template_id THEN
    RAISE EXCEPTION 'Invalid exam subject result' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER validate_exam_result BEFORE INSERT OR UPDATE ON "ExamSubjectResult" FOR EACH ROW EXECUTE FUNCTION validate_exam_subject_result();

COMMIT;
