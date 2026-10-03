package com.labguard.repository;

import com.labguard.entity.StudentClassAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentClassAssignmentRepository extends JpaRepository<StudentClassAssignment, UUID> {

    List<StudentClassAssignment> findByAcademicClassId(UUID classId);

    List<StudentClassAssignment> findByStudentId(UUID studentId);

    Optional<StudentClassAssignment> findByStudentIdAndAcademicClassId(UUID studentId, UUID classId);

    boolean existsByStudentIdAndAcademicClassId(UUID studentId, UUID classId);

    @Query("SELECT sca FROM StudentClassAssignment sca " +
           "WHERE sca.academicClass.faculty.user.id = :facultyUserId " +
           "AND sca.status = 'ACTIVE'")
    List<StudentClassAssignment> findActiveByFacultyUserId(@Param("facultyUserId") UUID facultyUserId);

    @Query("SELECT sca FROM StudentClassAssignment sca " +
           "WHERE sca.academicClass.id = :classId " +
           "AND sca.academicClass.faculty.user.id = :facultyUserId " +
           "AND sca.status = 'ACTIVE'")
    List<StudentClassAssignment> findActiveByClassIdAndFacultyUserId(
        @Param("classId") UUID classId,
        @Param("facultyUserId") UUID facultyUserId
    );
}
