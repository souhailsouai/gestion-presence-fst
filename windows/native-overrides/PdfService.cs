using System.IO;using PdfSharp.Drawing;
using PdfSharp.Pdf;
namespace GestionPresenceFST.Services;
public sealed class PdfService
{
    public void WriteSessionReport(SessionReport report, Stream output)
    {
        using var doc = new PdfDocument();
        var title = new XFont("Segoe UI", 16, XFontStyleEx.Bold);
        var normal = new XFont("Segoe UI", 9);
        var bold = new XFont("Segoe UI", 9, XFontStyleEx.Bold);
        var rowIndex = 0;
        do
        {
            var page = doc.AddPage(); page.Size = PdfSharp.PageSize.A4;
            using var g = XGraphics.FromPdfPage(page);
            double y=36;
            g.DrawString(report.Institution,title,XBrushes.DarkBlue,new XRect(30,y,page.Width.Point-60,24),XStringFormats.TopCenter);y+=32;
            g.DrawString($"Rapport de présence — {report.AcademicYear}",bold,XBrushes.Black,30,y);y+=18;
            g.DrawString($"Enseignant : {report.Teacher}",normal,XBrushes.Black,30,y);y+=15;
            g.DrawString($"{report.ClassLabel} — {report.Module}",normal,XBrushes.Black,30,y);y+=15;
            g.DrawString($"Date : {report.Date:dd/MM/yyyy}   {report.StartTime}–{report.EndTime}   Salle : {report.Room ?? "—"}",normal,XBrushes.Black,30,y);y+=20;
            g.DrawString($"Présents {report.Summary.Present} | Absents {report.Summary.Absent} | Retards {report.Summary.Late} | Justifiés {report.Summary.Excused}",bold,XBrushes.Black,30,y);y+=24;
            g.DrawString("Étudiant",bold,XBrushes.Black,30,y);g.DrawString("Statut",bold,XBrushes.Black,220,y);g.DrawString("Commentaire",bold,XBrushes.Black,310,y);g.DrawString("Note",bold,XBrushes.Black,500,y);y+=17;
            while(rowIndex<report.Rows.Count && y<790)
            {
                var r=report.Rows[rowIndex++];
                g.DrawString(Clip(r.StudentName,31),normal,XBrushes.Black,30,y);
                g.DrawString(r.Status,normal,XBrushes.Black,220,y);
                g.DrawString(Clip(string.IsNullOrWhiteSpace(r.Comment)?"—":r.Comment,30),normal,XBrushes.Black,310,y);
                g.DrawString(r.Grade is null?"—":$"{r.Grade:0.##} /20",normal,XBrushes.Black,500,y);
                y+=16;
            }
            g.DrawString($"Page {doc.PageCount}",normal,XBrushes.Gray,new XRect(30,812,page.Width.Point-60,14),XStringFormats.TopRight);
        } while (rowIndex < report.Rows.Count);
        doc.Save(output,false);
    }
    private static string Clip(string value,int max)=>value.Length<=max?value:value[..(max-1)]+"…";
}
