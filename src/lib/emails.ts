
import type { FormaAfriqueUser } from "@/context/RoleContext";
import type { Course } from "./types";

// NOTE: This is a placeholder for a real email sending service (e.g., SendGrid, Mailgun, etc.)
// In a real application, you would replace `console.log` with an API call to your email provider.

const sendEmail = ({ to, subject, html }: { to: string, subject: string, html: string }) => {
    console.log("--- Sending Email ---");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    // In a real scenario, you'd never log the full HTML, but for this simulation it's useful.
    // console.log(`HTML: ${html}`); 
    console.log("--------------------");
    // SIMULATE API CALL
    return Promise.resolve({ success: true });
}

const getStudentEmailTemplate = (studentName: string, courseName: string, courseId: string): string => {
    const courseUrl = `https://formaafrique-app.web.app/courses/${courseId}`;
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #020617; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Félicitations, ${studentName} !</h1>
        </div>
        <div style="padding: 30px;">
          <p>Bienvenue ! Vous êtes maintenant inscrit(e) à la formation :</p>
          <h2 style="font-size: 20px; margin: 20px 0;">${courseName}</h2>
          <p>Nous sommes ravis de vous accompagner dans cette nouvelle aventure d'apprentissage.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${courseUrl}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Accéder au cours</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee;" />
          <p style="font-style: italic; color: #555; margin-top: 20px;">
            "Bara ala, Tonga na ndara." (Bonjour, bienvenue dans le savoir) - Sango<br />
            "Mbote, boyeyi malamu na boyekoli." (Bonjour, bienvenue dans l'apprentissage) - Lingala
          </p>
        </div>
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #888;">
          <p>&copy; ${new Date().getFullYear()} FormaAfrique. Tous droits réservés.</p>
        </div>
      </div>
    `;
};

const getInstructorEmailTemplate = (instructorName: string, studentName: string, courseName: string): string => {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #10b981; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Nouvelle Inscription !</h1>
        </div>
        <div style="padding: 30px;">
          <p>Bonjour ${instructorName},</p>
          <p>Bonne nouvelle ! Un nouvel étudiant vient de rejoindre l'une de vos formations.</p>
          <p style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
            <strong>Étudiant :</strong> ${studentName}<br>
            <strong>Formation :</strong> ${courseName}
          </p>
          <p>C'est une excellente occasion d'accueillir ce nouvel apprenant dans votre communauté.</p>
        </div>
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #888;">
          <p>&copy; ${new Date().getFullYear()} FormaAfrique. Tous droits réservés.</p>
        </div>
      </div>
    `;
};

export const sendEnrollmentEmails = async (student: FormaAfriqueUser, course: Course, instructor: FormaAfriqueUser) => {
    if (!student.email || !instructor.email) {
        console.error("Missing email for student or instructor.");
        return;
    }

    // --- Email to Student ---
    const studentHtml = getStudentEmailTemplate(student.fullName, course.title, course.id);
    await sendEmail({
        to: student.email,
        subject: `Bienvenue à la formation : ${course.title}`,
        html: studentHtml,
    });

    // --- Email to Instructor ---
    const instructorHtml = getInstructorEmailTemplate(instructor.fullName, student.fullName, course.title);
    await sendEmail({
        to: instructor.email,
        subject: `Nouvel étudiant inscrit à votre cours : ${course.title}`,
        html: instructorHtml,
    });
};
