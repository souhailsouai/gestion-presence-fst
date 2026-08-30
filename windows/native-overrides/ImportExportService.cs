using System.IO;using System.Globalization;using System.Text;using System.Text.Json;using CsvHelper;using CsvHelper.Configuration;using GestionPresenceFST.Data.Rows;using GestionPresenceFST.Domain;
namespace GestionPresenceFST.Services;
public sealed record ImportResult(int StudentCount,int ClassCount);
public sealed class ImportExportService
{
 private readonly ClassService _classes;private readonly StudentService _students;private readonly Data.SupabaseGateway _gateway;
 public ImportExportService(ClassService c,StudentService s,Data.SupabaseGateway g){_classes=c;_students=s;_gateway=g;}
 public async Task<ImportResult> ImportStudentsCsvAsync(Stream input,UserContext user,CancellationToken ct=default)
 {
  if(input.CanSeek&&input.Length>5_000_000)throw new InvalidDataException("Fichier CSV trop volumineux.");using var sr=new StreamReader(input,Encoding.UTF8,true,leaveOpen:true);var sample=await sr.ReadLineAsync(ct)??"";if(input.CanSeek)input.Position=0;var delim=sample.Count(c=>c==';')>sample.Count(c=>c==',')?";":",";using var reader=new StreamReader(input,Encoding.UTF8,true,leaveOpen:true);using var csv=new CsvReader(reader,new CsvConfiguration(CultureInfo.InvariantCulture){Delimiter=delim,PrepareHeaderForMatch=a=>a.Header.Trim().ToLowerInvariant()});var records=csv.GetRecords<dynamic>().ToList();var classes=(await _classes.LoadAsync(user,ct)).ToList();int newClasses=0,count=0;
  foreach(IDictionary<string,object> d in records){string Get(params string[] keys){foreach(var k in keys){var pair=d.FirstOrDefault(x=>string.Equals(x.Key,k,StringComparison.OrdinalIgnoreCase));if(pair.Key!=null)return Convert.ToString(pair.Value)?.Trim()??"";}return"";}var className=Get("Classe","classe");var cls=classes.FirstOrDefault(x=>string.Equals(x.Name,className,StringComparison.OrdinalIgnoreCase));if(cls is null){cls=await _classes.CreateAsync(new NewClassInput(className,null,null,null,"Général",null,null,null,null),user,ct);classes.Add(cls);newClasses++;}await _students.CreateAsync(new NewStudentInput(cls.Id,Get("Nom","nom"),Get("Prénom","Prenom","prenom"),Get("Email","email")),user,ct);count++;}
  return new(count,newClasses);
 }
 public async Task ExportAttendanceCsvAsync(Stream output,UserContext user,CancellationToken ct=default){var rows=await _gateway.Client.From<AttendanceRow>().Where(x=>x.TeacherId==user.UserId).Get(ct);using var sw=new StreamWriter(output,Encoding.UTF8,leaveOpen:true);await sw.WriteLineAsync("session_id,student_id,status,comment,grade");foreach(var r in rows.Models)await sw.WriteLineAsync($"{r.SessionId},{r.StudentId},{r.Status},\"{(r.Comment??"").Replace("\"","\"\"")}\",{r.Grade}");await sw.FlushAsync(ct);}
 public async Task ExportAdminBackupJsonAsync(Stream output,CancellationToken ct=default){var data=new{profiles=(await _gateway.Client.From<ProfileRow>().Get(ct)).Models,classes=(await _gateway.Client.From<ClassRow>().Get(ct)).Models,students=(await _gateway.Client.From<StudentRow>().Get(ct)).Models,sessions=(await _gateway.Client.From<SessionRow>().Get(ct)).Models,attendance=(await _gateway.Client.From<AttendanceRow>().Get(ct)).Models};await JsonSerializer.SerializeAsync(output,data,cancellationToken:ct);}
 public async Task RestoreAdminBackupJsonAsync(Stream input,CancellationToken ct=default)
 {
  if(input.CanSeek&&input.Length>20_000_000)throw new InvalidDataException("Sauvegarde JSON trop volumineuse.");
  var backup=await JsonSerializer.DeserializeAsync<AdminBackup>(input,new JsonSerializerOptions{PropertyNameCaseInsensitive=true},ct)??throw new InvalidDataException("Sauvegarde JSON invalide.");
  foreach(var x in backup.Profiles??[])await _gateway.Client.From<ProfileRow>().Upsert(x,cancellationToken:ct);
  foreach(var x in backup.Classes??[])await _gateway.Client.From<ClassRow>().Upsert(x,cancellationToken:ct);
  foreach(var x in backup.Students??[])await _gateway.Client.From<StudentRow>().Upsert(x,cancellationToken:ct);
  foreach(var x in backup.Sessions??[])await _gateway.Client.From<SessionRow>().Upsert(x,cancellationToken:ct);
  foreach(var x in backup.Attendance??[])await _gateway.Client.From<AttendanceRow>().Upsert(x,cancellationToken:ct);
 }
 private sealed class AdminBackup
 {
  public List<ProfileRow>? Profiles{get;set;} public List<ClassRow>? Classes{get;set;} public List<StudentRow>? Students{get;set;} public List<SessionRow>? Sessions{get;set;} public List<AttendanceRow>? Attendance{get;set;}
 }

}
